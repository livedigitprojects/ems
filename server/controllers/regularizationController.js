import Employee                 from "../models/Employee.js"
import Attendance               from "../models/Attendance.js"
import AttendanceRegularization from "../models/AttendanceRegularization.js"
import LateRegularization       from "../models/LateRegularization.js"
import LeaveApplication         from "../models/LeaveApplication.js"
import Payslip                  from "../models/Payslip.js"
import { createNotification, getAdminUserIds } from "./notificationController.js"
import { getMonthCounts, calcSalary } from "./payslipController.js"
import { getHolidayMapForMonth, getHolidayName } from "../utils/attendanceConfig.js"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const getLeaveApprovedDates = (leaves, monthStartUTC, monthEndUTC) => {
  const result = {}
  for (const leave of leaves) {
    // Only show APPROVED and PENDING leaves on the calendar; skip REJECTED
    if (leave.status === "REJECTED") continue
    const start = new Date(Math.max(new Date(leave.startDate), monthStartUTC))
    const end   = new Date(Math.min(new Date(leave.endDate),   monthEndUTC))
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const istDate = new Date(d.getTime() + IST_OFFSET_MS)
      const key     = istDate.toISOString().slice(0, 10)
      result[key] = { type: leave.type, status: leave.status, isPresent: leave.type !== "LOSS_OF_PAY" }
    }
  }
  return result
}

// Shared core: builds the month attendance map for a given employee.
// Used by both the employee's own "/month-map" route and the admin
// "/month-map/:employeeId" route so the two views can never drift apart.
const buildMonthAttendanceMap = async (employee, year, month) => {
  const monthStartUTC = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - IST_OFFSET_MS)
  const monthEndUTC   = new Date(Date.UTC(year, month,     1, 0, 0, 0) - IST_OFFSET_MS)

  const [attendanceRecords, regularizations, lateRegs, approvedLeaves] = await Promise.all([
    Attendance.find({ employeeId: employee._id, date: { $gte: monthStartUTC, $lt: monthEndUTC } }).lean(),
    AttendanceRegularization.find({ employeeId: employee._id, date: { $gte: monthStartUTC, $lt: monthEndUTC } }).lean(),
    LateRegularization.find({ employeeId: employee._id, date: { $gte: monthStartUTC, $lt: monthEndUTC } }).lean(),
    LeaveApplication.find({
      employeeId: employee._id,
      startDate:  { $lt: monthEndUTC },
      endDate:    { $gte: monthStartUTC },
    }).lean(),
  ])

  const attMap = {}
  for (const r of attendanceRecords) {
    const istDate = new Date(r.date.getTime() + IST_OFFSET_MS)
    const key = istDate.toISOString().slice(0, 10)
    attMap[key] = { status: r.status, checkIn: r.checkIn, checkOut: r.checkOut, workingHours: r.workingHours, dayType: r.dayType }
  }

  const regMap = {}
  for (const r of regularizations) {
    const key = new Date(r.date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
    regMap[key] = { _id: r._id.toString(), status: r.status, reason: r.reason, remarks: r.remarks, adminRemark: r.adminRemark }
  }

  const lateRegMap = {}
  for (const r of lateRegs) {
    const key = new Date(r.date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
    lateRegMap[key] = { _id: r._id.toString(), status: r.status, reason: r.reason, remarks: r.remarks, adminRemark: r.adminRemark }
  }

  const leaveDateMap = getLeaveApprovedDates(approvedLeaves, monthStartUTC, monthEndUTC)
  const holidays     = await getHolidayMapForMonth(year, month)   // { "YYYY-MM-DD": "Holiday name" }

  return {
    holidays,
    attendance:          attMap,
    regularizations:     regMap,
    lateRegularizations: lateRegMap,
    leaveDateMap,
    weekOff: employee.workSchedule?.weekOff ?? [],
    year,
    month,
  }
}

const resolveYearMonth = (query) => {
  const now    = new Date()
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)
  const year   = parseInt(query.year)  || istNow.getUTCFullYear()
  const month  = parseInt(query.month) || istNow.getUTCMonth() + 1
  return { year, month }
}

export const getMonthAttendanceMap = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.session.userId })
    if (!employee) return res.status(404).json({ error: "Employee not found" })

    const { year, month } = resolveYearMonth(req.query)
    const data = await buildMonthAttendanceMap(employee, year, month)

    return res.json({ data })
  } catch (err) {
    console.error("getMonthAttendanceMap error:", err)
    return res.status(500).json({ error: "Failed to fetch attendance map" })
  }
}

// Admin, read-only: same shape as getMonthAttendanceMap but for any employee,
// used by the Attendance Calendar section on the admin Regularization page.
export const getMonthAttendanceMapForAdmin = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId).lean()
    if (!employee) return res.status(404).json({ error: "Employee not found" })

    const { year, month } = resolveYearMonth(req.query)
    const data = await buildMonthAttendanceMap(employee, year, month)

    return res.json({
      data,
      employee: {
        id: employee._id.toString(),
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department,
        position: employee.position,
      },
    })
  } catch (err) {
    console.error("getMonthAttendanceMapForAdmin error:", err)
    return res.status(500).json({ error: "Failed to fetch attendance map" })
  }
}

export const createRegularization = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.session.userId })
    if (!employee)          return res.status(404).json({ error: "Employee not found" })
    if (employee.isDeleted) return res.status(403).json({ error: "Your account is deactivated." })

    const { date, reason, remarks } = req.body
    if (!date || !reason) return res.status(400).json({ error: "Date and reason are required" })

    const validReasons = ["FORGOT_TO_CHECKIN", "SYSTEM_ERROR", "WORKED_FROM_HOME", "CLIENT_VISIT", "OTHER"]
    if (!validReasons.includes(reason)) return res.status(400).json({ error: "Invalid reason" })

    const [y, m, d] = date.split("-").map(Number)
    const utcDate   = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - IST_OFFSET_MS)

    const holidayName = await getHolidayName(date)
    if (holidayName)
      return res.status(400).json({ error: `${date} is a company holiday (${holidayName}). No regularization is needed.` })

    const existing = await Attendance.findOne({ employeeId: employee._id, date: utcDate })
    if (existing) return res.status(400).json({ error: "You already have attendance recorded for this date." })

    const dupReg = await AttendanceRegularization.findOne({ employeeId: employee._id, date: utcDate })
    if (dupReg)   return res.status(400).json({ error: "A regularization request already exists for this date." })

    const reg = await AttendanceRegularization.create({
      employeeId: employee._id, date: utcDate, reason, remarks: remarks || "",
    })

    const adminIds = await getAdminUserIds()
    const empName  = `${employee.firstName} ${employee.lastName}`
    await Promise.all(adminIds.map(adminId =>
      createNotification({
        recipientId: adminId, recipientRole: "ADMIN", type: "REGULARIZATION_REQUEST",
        title: "New Regularization Request",
        message: `${empName} submitted an attendance regularization request for ${date}`,
        refId: reg._id, refType: "AttendanceRegularization",
      })
    ))

    return res.json({ success: true, data: reg })
  } catch (err) {
    console.error("createRegularization error:", err)
    return res.status(500).json({ error: "Failed to submit regularization" })
  }
}

export const createLateRegularization = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.session.userId })
    if (!employee)          return res.status(404).json({ error: "Employee not found" })
    if (employee.isDeleted) return res.status(403).json({ error: "Your account is deactivated." })

    const { date, reason, remarks } = req.body
    if (!date || !reason) return res.status(400).json({ error: "Date and reason are required" })

    const [y, m, d] = date.split("-").map(Number)
    const utcDate   = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - IST_OFFSET_MS)

    const attRec = await Attendance.findOne({ employeeId: employee._id, date: utcDate })
    if (!attRec || attRec.status !== "LATE")
      return res.status(400).json({ error: "No late attendance record found for this date." })

    const dupReg = await LateRegularization.findOne({ employeeId: employee._id, date: utcDate })
    if (dupReg)  return res.status(400).json({ error: "A late regularization request already exists for this date." })

    const reg = await LateRegularization.create({
      employeeId: employee._id, date: utcDate, reason, remarks: remarks || "",
    })

    const adminIds = await getAdminUserIds()
    const empName  = `${employee.firstName} ${employee.lastName}`
    await Promise.all(adminIds.map(adminId =>
      createNotification({
        recipientId: adminId, recipientRole: "ADMIN", type: "LATE_REGULARIZATION_REQUEST",
        title: "New Late Regularization Request",
        message: `${empName} submitted a late attendance regularization for ${date}`,
        refId: reg._id, refType: "LateRegularization",
      })
    ))

    return res.json({ success: true, data: reg })
  } catch (err) {
    console.error("createLateRegularization error:", err)
    return res.status(500).json({ error: "Failed to submit late regularization" })
  }
}

// export const getRegularizations = async (req, res) => {
//   try {
//     const { status, type } = req.query
//     const where = status ? { status } : {}

//     if (type === "LATE") {
//       const regs = await LateRegularization.find(where)
//         .populate("employeeId", "firstName lastName department position avatar")
//         .sort({ createdAt: -1 }).lean()
//       const data = regs.filter(r => r.employeeId && !r.employeeId.isDeleted)
//         .map(r => ({ ...r, _id: r._id.toString(), employee: r.employeeId, regType: "LATE" }))
//       return res.json({ data })
//     }

//     const regs = await AttendanceRegularization.find(where)
//       .populate("employeeId", "firstName lastName department position avatar")
//       .sort({ createdAt: -1 }).lean()
//     const data = regs.filter(r => r.employeeId && !r.employeeId.isDeleted)
//       .map(r => ({ ...r, _id: r._id.toString(), employee: r.employeeId, regType: "ABSENT" }))
//     return res.json({ data })
//   } catch (err) {
//     console.error("getRegularizations error:", err)
//     return res.status(500).json({ error: "Failed to fetch regularizations" })
//   }
// }

// A Payslip is a stored snapshot, not a live computation — so if an admin
// approves/rejects a regularization for a date AFTER that month's payslip
// was already generated, the stored payslip silently keeps its old numbers
// (e.g. still deducting for a late day that's now approved as Present).
// Whenever a decision changes that day's attendance, re-run the exact same
// calculation the payslip was built with and save the result in place, so
// the two can never drift apart regardless of the order things happen in.

export const getRegularizations = async (req, res) => {
  try {
    const { status, type, employeeId } = req.query
    const where = status ? { status } : {}
    if (employeeId) where.employeeId = employeeId

    if (type === "LATE") {
      const regs = await LateRegularization.find(where)
        .populate("employeeId", "firstName lastName department position avatar")
        .sort({ createdAt: -1 }).lean()
      const data = regs.filter(r => r.employeeId && !r.employeeId.isDeleted)
        .map(r => ({ ...r, _id: r._id.toString(), employee: r.employeeId, regType: "LATE" }))
      return res.json({ data })
    }

    const regs = await AttendanceRegularization.find(where)
      .populate("employeeId", "firstName lastName department position avatar")
      .sort({ createdAt: -1 }).lean()
    const data = regs.filter(r => r.employeeId && !r.employeeId.isDeleted)
      .map(r => ({ ...r, _id: r._id.toString(), employee: r.employeeId, regType: "ABSENT" }))
    return res.json({ data })
  } catch (err) {
    console.error("getRegularizations error:", err)
    return res.status(500).json({ error: "Failed to fetch regularizations" })
  }
}


const resyncPayslipIfExists = async (employeeId, date) => {
  try {
    const istDate = new Date(date.getTime() + IST_OFFSET_MS)
    const month   = istDate.getUTCMonth() + 1
    const year    = istDate.getUTCFullYear()

    const payslip = await Payslip.findOne({ employeeId, month, year })
    if (!payslip) return // nothing generated yet for this month — nothing to fix

    const employee = await Employee.findById(employeeId).lean()
    if (!employee) return

    const weekOff = employee.workSchedule?.weekOff ?? []
    const counts  = await getMonthCounts(employeeId, month, year, weekOff)
    const { workingDays, presentDays, absentDays, lopWorkedDays, lateDeductionDays } = counts

    const { earnedBasic, lateAmount, netSalary } =
      calcSalary(payslip.basicSalary, payslip.allowances, workingDays, presentDays, lateDeductionDays)

    payslip.workingDays = workingDays
    payslip.presentDays = presentDays
    payslip.absentDays  = absentDays
    payslip.lopDays      = lopWorkedDays
    payslip.earnedBasic = earnedBasic
    payslip.deductions   = lateAmount
    payslip.netSalary    = netSalary
    await payslip.save()

    console.log(`[Payslip resync] Updated existing payslip for employee ${employeeId} (${month}/${year}) after regularization decision`)
  } catch (err) {
    // Never let a payslip resync failure block the approval/rejection itself
    console.error("resyncPayslipIfExists error:", err)
  }
}

export const updateRegularizationStatus = async (req, res) => {
  try {
    const { status, adminRemark } = req.body
    if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ error: "Invalid status" })

    const reg = await AttendanceRegularization.findById(req.params.id)
    if (!reg) return res.status(404).json({ error: "Request not found" })

    reg.status = status; reg.adminRemark = adminRemark || ""; await reg.save()

    if (status === "APPROVED") {
      const existingAtt = await Attendance.findOne({ employeeId: reg.employeeId, date: reg.date })
      if (!existingAtt) {
        await Attendance.create({
          employeeId: reg.employeeId, date: reg.date,
          checkIn: null, checkOut: null, status: "PRESENT", workingHours: 9, dayType: "Full Day",
        })
      }
    }

    await resyncPayslipIfExists(reg.employeeId, reg.date)

    const emp = await Employee.findById(reg.employeeId).select("userId").lean()
    if (emp?.userId) {
      const dateStr = new Date(reg.date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
      await createNotification({
        recipientId: emp.userId, recipientRole: "EMPLOYEE",
        type: status === "APPROVED" ? "REGULARIZATION_APPROVED" : "REGULARIZATION_REJECTED",
        title: `Regularization Request ${status === "APPROVED" ? "Approved" : "Rejected"}`,
        message: `Your attendance regularization for ${dateStr} has been ${status.toLowerCase()}.${adminRemark ? " Admin note: " + adminRemark : ""}`,
        refId: reg._id, refType: "AttendanceRegularization",
      })
    }

    return res.json({ success: true, data: reg })
  } catch (err) {
    console.error("updateRegularizationStatus error:", err)
    return res.status(500).json({ error: "Failed to update status" })
  }
}

export const updateLateRegularizationStatus = async (req, res) => {
  try {
    const { status, adminRemark } = req.body
    if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ error: "Invalid status" })

    const reg = await LateRegularization.findById(req.params.id)
    if (!reg) return res.status(404).json({ error: "Request not found" })

    reg.status = status; reg.adminRemark = adminRemark || ""; await reg.save()

    // Keep the Attendance record in sync with the decision. Approving must
    // actually flip that day's status to PRESENT — otherwise the calendar,
    // late-count, and salary/late-deduction calculations (which all read
    // Attendance.status directly) still see the day as LATE even though the
    // admin approved it. Rejecting restores LATE (covers the case where a
    // previously-approved request gets reversed).
    await Attendance.updateOne(
      { employeeId: reg.employeeId, date: reg.date },
      { $set: { status: status === "APPROVED" ? "PRESENT" : "LATE" } }
    )

    await resyncPayslipIfExists(reg.employeeId, reg.date)

    const emp = await Employee.findById(reg.employeeId).select("userId").lean()
    if (emp?.userId) {
      const dateStr = new Date(reg.date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
      await createNotification({
        recipientId: emp.userId, recipientRole: "EMPLOYEE",
        type: status === "APPROVED" ? "LATE_REGULARIZATION_APPROVED" : "LATE_REGULARIZATION_REJECTED",
        title: `Late Regularization ${status === "APPROVED" ? "Approved" : "Rejected"}`,
        message: `Your late attendance regularization for ${dateStr} has been ${status.toLowerCase()}. It is counted as Present for calculations.${adminRemark ? " Admin note: " + adminRemark : ""}`,
        refId: reg._id, refType: "LateRegularization",
      })
    }

    return res.json({ success: true, data: reg })
  } catch (err) {
    console.error("updateLateRegularizationStatus error:", err)
    return res.status(500).json({ error: "Failed to update late regularization status" })
  }
}

