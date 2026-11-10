import Employee            from "../models/Employee.js"
import Payslip              from "../models/Payslip.js"
import LeaveApplication     from "../models/LeaveApplication.js"
import Attendance           from "../models/Attendance.js"
import LateRegularization   from "../models/LateRegularization.js"
import { createNotification } from "./notificationController.js"
import { getHolidayMapForMonth } from "../utils/attendanceConfig.js"
import { buildPayslipWorkbookBuffer } from "../utils/payslipExcel.js"

// --- Month filter (admin payslip list + Excel export share this) -------------
// Accepts ?from=YYYY-MM&to=YYYY-MM (either may be omitted: one month only).
const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const periodExpr   = { $add: [{ $multiply: ["$year", 100] }, "$month"] }

const parsePeriodFilter = (query) => {
    const { from, to } = query
    if (!from && !to) return { filter: {}, label: "All periods", slug: "all" }

    const f = MONTH_KEY_RE.exec(from || to)
    const m2 = MONTH_KEY_RE.exec(to || from)
    if (!f || !m2) return { error: "Invalid period. Use YYYY-MM for 'from' and 'to'." }

    const fromKey = Number(f[1]) * 100 + Number(f[2])
    const toKey   = Number(m2[1]) * 100 + Number(m2[2])
    if (fromKey > toKey) return { error: "'From' month must not be after 'To' month" }

    const lbl = (m) => `${MONTH_LABELS[Number(m[2]) - 1]} ${m[1]}`
    return {
        filter: { $expr: { $and: [{ $gte: [periodExpr, fromKey] }, { $lte: [periodExpr, toKey] }] } },
        label:  fromKey === toKey ? lbl(f) : `${lbl(f)} - ${lbl(m2)}`,
        slug:   fromKey === toKey ? `${f[1]}-${f[2]}` : `${f[1]}-${f[2]}_to_${m2[1]}-${m2[2]}`,
    }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const countDays = (start, end) =>
    Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1

const DAY_INDEX = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
}

const weekOffIndices = (weekOff = []) => {
    if (!weekOff.length) return new Set([0])
    return new Set(weekOff.map((d) => DAY_INDEX[d.toLowerCase()]).filter((n) => n !== undefined))
}

const getWorkingDatesOfMonth = (month, year, weekOff = []) => {
    const offDays     = weekOffIndices(weekOff)
    const daysInMonth = new Date(year, month, 0).getDate()
    const dates       = []
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d)
        if (!offDays.has(date.getDay())) {
            const mm = String(month).padStart(2, "0")
            const dd = String(d).padStart(2, "0")
            dates.push(`${year}-${mm}-${dd}`)
        }
    }
    return dates
}

/**
 * Working days = calendar days − weekoff occurrences (varies month to month
 * depending on how many weekoff days fall in that month). No fixed leave
 * deduction — this MUST match the same date universe used by getMonthCounts,
 * otherwise presentDays/absentDays are computed against a different total
 * than the salary denominator (perDaySalary) and the numbers won't add up.
 */
const getWorkingDays = (month, year, weekOff = []) =>
    Math.max(1, getWorkingDatesOfMonth(month, year, weekOff).length)

const toISTDateStr = (utcDate) =>
    new Date(new Date(utcDate).getTime() + IST_OFFSET_MS)
        .toISOString()
        .slice(0, 10)

/**
 * Attendance breakdown for a month.
 *
 * presentDays  = clockInDays + paidLeaveDays (SL/CL/EL with no clock-in)
 * lopDays      = approved LOP days with no clock-in (treated as absent — no extra deduction)
 * absentDays   = workingDays − presentDays − lopDays
 *
 * LOP days are NOT included in presentDays.
 * They are just absent days with a reason — salary is already reduced
 * because presentDays is lower. No separate lopAmount deduction.
 */
export const getMonthCounts = async (employeeId, month, year, weekOff = []) => {
    // Company holidays are paid non-working days: drop them from the working-day
    // universe so they are never counted as absences (or in the salary denominator).
    const holidayMap   = await getHolidayMapForMonth(year, month)
    const workingDates = getWorkingDatesOfMonth(month, year, weekOff).filter((d) => !holidayMap[d])
    const workingDays  = Math.max(1, workingDates.length)

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month, 0, 23, 59, 59)

    const queryStart = new Date(monthStart.getTime() - IST_OFFSET_MS)
    const queryEnd   = new Date(monthEnd.getTime()   + IST_OFFSET_MS)

    const [records, leaves, approvedLateRegs] = await Promise.all([
        Attendance.find({ employeeId, date: { $gte: queryStart, $lte: queryEnd } }).lean(),
        LeaveApplication.find({
            employeeId,
            status:    "APPROVED",
            startDate: { $lte: monthEnd },
            endDate:   { $gte: monthStart },
        }).lean(),
        LateRegularization.find({
            employeeId, status: "APPROVED",
            date: { $gte: queryStart, $lte: queryEnd },
        }).lean(),
    ])

    // A late day only counts against the employee if it's still LATE in
    // Attendance AND has no approved regularization for it. Checking the
    // LateRegularization collection directly here — rather than trusting
    // Attendance.status alone — means an approved late can never show up
    // as a deduction, even if that status sync ever falls out of step.
    const approvedLateDates = new Set(approvedLateRegs.map(r => toISTDateStr(r.date)))

    const clockedInDates = new Set(records.map((r) => toISTDateStr(r.date)))
    const lateDates      = new Set(
        records
            .filter(r => r.status === "LATE" && !approvedLateDates.has(toISTDateStr(r.date)))
            .map(r => toISTDateStr(r.date))
    )
    const lopDates       = new Set()
    const paidLeaveDates = new Set()

    for (const leave of leaves) {
        const start = new Date(Math.max(new Date(leave.startDate), monthStart))
        const end   = new Date(Math.min(new Date(leave.endDate),   monthEnd))
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const mm  = String(d.getMonth() + 1).padStart(2, "0")
            const dd  = String(d.getDate()).padStart(2, "0")
            const str = `${d.getFullYear()}-${mm}-${dd}`
            if (leave.type === "LOSS_OF_PAY") lopDates.add(str)
            else                              paidLeaveDates.add(str)
        }
    }

    const clockInDays       = workingDates.filter((d) => clockedInDates.has(d)).length
    const lateCount         = workingDates.filter((d) => lateDates.has(d)).length
    const paidLeaveDays     = workingDates.filter(
        (d) => !clockedInDates.has(d) && paidLeaveDates.has(d) && !lopDates.has(d)
    ).length
    const lopWorkedDays     = workingDates.filter(
        (d) => !clockedInDates.has(d) && lopDates.has(d)
    ).length
    const presentDays       = clockInDays + paidLeaveDays
    const absentDays        = Math.max(0, workingDays - presentDays - lopWorkedDays)
    const lateDeductionDays = Math.floor(lateCount / 3)

    return { workingDays, clockInDays, lateCount, lateDeductionDays, paidLeaveDays, lopWorkedDays, presentDays, absentDays }
}

/**
 * Salary calculation — single source of truth.
 *
 * Formula:
 *   perDaySalary = basicSalary / workingDays
 *   earnedBasic  = perDaySalary × presentDays          (only days actually worked/paid leave)
 *   lateAmount   = perDaySalary × lateDeductionDays    (every 3 lates = 1 day deducted)
 *   lopAmount    = 0                                   (LOP = absent, already excluded from presentDays)
 *   netSalary    = earnedBasic − lateAmount + allowances
 *
 * LOP days reduce presentDays naturally — absent deduction already covers them.
 * A separate lopAmount deduction would double-count the same absent days.
 */
export const calcSalary = (basicSalary, allowances, workingDays, presentDays, lateDeductionDays = 0) => {
    // Use the FULL-PRECISION per-day rate for the actual math — rounding this
    // first (e.g. to 2 decimals) before multiplying by presentDays compounds
    // into a few paise/rupees of error over the month. Only round the final
    // rupee amounts that get stored/displayed.
    const rawPerDaySalary = workingDays > 0 ? basicSalary / workingDays : 0

    const perDaySalary = parseFloat(rawPerDaySalary.toFixed(2)) // display only
    const earnedBasic  = parseFloat((rawPerDaySalary * presentDays).toFixed(2))
    const lateAmount   = parseFloat((rawPerDaySalary * lateDeductionDays).toFixed(2))
    const lopAmount    = 0
    const netSalary    = parseFloat((earnedBasic - lateAmount + allowances).toFixed(2))
    return { perDaySalary, earnedBasic, lateAmount, lopAmount, netSalary }
}

/**
 * Leave type counts for the payslip print view.
 */
const getTakenLeaveCountsForMonth = async (employeeId, month, year) => {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month, 0, 23, 59, 59)

    const approved = await LeaveApplication.find({
        employeeId,
        status:    "APPROVED",
        startDate: { $lte: monthEnd },
        endDate:   { $gte: monthStart },
        type:      { $in: ["SICK", "CASUAL", "EARNED", "LOSS_OF_PAY"] },
    })

    const taken = { SICK: 0, CASUAL: 0, EARNED: 0, LOSS_OF_PAY: 0 }
    for (const leave of approved) {
        const start = new Date(Math.max(new Date(leave.startDate), monthStart))
        const end   = new Date(Math.min(new Date(leave.endDate),   monthEnd))
        if (end < start) continue
        const days = countDays(start, end)
        if (taken[leave.type] !== undefined) taken[leave.type] += days
    }
    return taken
}

// ─── Create Payslip ───────────────────────────────────────────────────────────
export const createPayslip = async (req, res) => {
    try {
        const { employeeId, month, year, allowances: customAllowances } = req.body

        if (!employeeId || !month || !year)
            return res.status(400).json({ error: "employeeId, month and year are required" })

        const employee = await Employee.findById(employeeId)
        if (!employee) return res.status(404).json({ error: "Employee not found" })

        const m = Number(month)
        const y = Number(year)

        const basicSalary = employee.basicSalary || 0
        const allowances  = customAllowances !== undefined
            ? Number(customAllowances)
            : (employee.allowances || 0)

        const weekOff = employee.workSchedule?.weekOff ?? []
        const counts  = await getMonthCounts(employee._id, m, y, weekOff)
        const { workingDays, presentDays, absentDays, lopWorkedDays, lateDeductionDays } = counts

        const { earnedBasic, lateAmount, lopAmount, netSalary } =
            calcSalary(basicSalary, allowances, workingDays, presentDays, lateDeductionDays)

        const payslip = await Payslip.create({
            employeeId,
            month:      m,
            year:       y,
            basicSalary,
            allowances,
            earnedBasic,
            deductions:  lateAmount,
            lopDays:     lopWorkedDays,
            lopAmount:   0,
            netSalary,
            workingDays,
            presentDays,
            absentDays,
        })

        // Notify the specific employee this payslip was generated for
        if (employee.userId) {
            await createNotification({
                recipientId:   employee.userId,
                recipientRole: "EMPLOYEE",
                type:          "PAYSLIP_GENERATED",
                title:         "Payslip Generated",
                message:       `Your payslip for ${MONTH_NAMES[m - 1]} ${y} is now available.`,
                refId:         payslip._id,
                refType:       "Payslip",
            })
        }

        return res.json({ success: true, data: payslip })

    } catch (error) {
        if (error.code === 11000)
            return res.status(400).json({ error: "Payslip for this employee/month/year already exists" })
        console.error("createPayslip error:", error)
        return res.status(500).json({ error: "Failed to create payslip" })
    }
}

// ─── Update Payslip (admin only) ──────────────────────────────────────────────
export const updatePayslip = async (req, res) => {
    try {
        const { basicSalary, allowances } = req.body

        const payslip = await Payslip.findById(req.params.id)
        if (!payslip) return res.status(404).json({ error: "Payslip not found" })

        if (basicSalary !== undefined) payslip.basicSalary = Number(basicSalary)
        if (allowances  !== undefined) payslip.allowances  = Number(allowances)

        const employee = await Employee.findById(payslip.employeeId).lean()
        const weekOff  = employee?.workSchedule?.weekOff ?? []
        const counts   = await getMonthCounts(payslip.employeeId, payslip.month, payslip.year, weekOff)
        const { workingDays, presentDays, absentDays, lopWorkedDays, lateDeductionDays } = counts

        const { earnedBasic, lateAmount, lopAmount, netSalary } =
            calcSalary(payslip.basicSalary, payslip.allowances, workingDays, presentDays, lateDeductionDays)

        payslip.earnedBasic = earnedBasic
        payslip.deductions  = lateAmount
        payslip.lopAmount   = 0
        payslip.lopDays     = lopWorkedDays
        payslip.netSalary   = netSalary
        payslip.workingDays = workingDays
        payslip.presentDays = presentDays
        payslip.absentDays  = absentDays

        await payslip.save()
        return res.json({ success: true, data: payslip })

    } catch (error) {
        console.error("updatePayslip error:", error)
        return res.status(500).json({ error: "Failed to update payslip" })
    }
}

// ─── Get Payslips (list) ──────────────────────────────────────────────────────
export const getPayslips = async (req, res) => {
    try {
        const isAdmin = req.session.role === "ADMIN"

        if (isAdmin) {
            const { filter, error } = parsePeriodFilter(req.query)
            if (error) return res.status(400).json({ error })

            const payslips = await Payslip.find(filter)
                .populate("employeeId", "firstName lastName email position department joinDate isDeleted employeeId")
                .sort({ createdAt: -1 })

            const data = payslips
                .filter((p) => p.employeeId && !p.employeeId.isDeleted)
                .map((p) => {
                    const obj = p.toObject()
                    return {
                        ...obj,
                        id:         obj._id.toString(),
                        employee:   obj.employeeId,
                        employeeId: obj.employeeId?._id?.toString(),
                    }
                })

            return res.json({ data })
        }

        const employee = await Employee.findOne({ userId: req.session.userId })
        if (!employee) return res.status(404).json({ error: "Employee not found" })

        const raw  = await Payslip.find({ employeeId: employee._id }).sort({ createdAt: -1 }).lean()
        const data = raw.map((p) => ({ ...p, id: p._id.toString() }))

        return res.json({ data })

    } catch (error) {
        console.error("getPayslips error:", error)
        return res.status(500).json({ error: "Failed to fetch payslips" })
    }
}

// --- Export filtered payslips to Excel (admin) --------------------------------
export const exportPayslips = async (req, res) => {
    try {
        const { filter, error, label, slug } = parsePeriodFilter(req.query)
        if (error) return res.status(400).json({ error })

        const docs = await Payslip.find(filter)
            .populate("employeeId", "firstName lastName position department employeeId isDeleted")
            .lean()

        // Same visibility rule as the on-screen list: skip deactivated employees.
        const rows = docs
            .filter((p) => p.employeeId && !p.employeeId.isDeleted)
            .map((p) => ({ ...p, employee: p.employeeId }))
            .sort((a, b) =>
                (a.year - b.year) || (a.month - b.month) ||
                `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(`${b.employee.firstName} ${b.employee.lastName}`)
            )

        if (!rows.length)
            return res.status(404).json({ error: "No payslips match the selected filters" })

        const buffer = await buildPayslipWorkbookBuffer(rows, { periodLabel: label })

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", `attachment; filename="payslips_${slug}.xlsx"`)
        return res.send(buffer)
    } catch (error) {
        console.error("exportPayslips error:", error)
        return res.status(500).json({ error: "Failed to export payslips" })
    }
}

// ─── Get Payslip By ID (print view) ──────────────────────────────────────────
export const getPayslipById = async (req, res) => {
    try {
        const payslip = await Payslip.findById(req.params.id).lean()
        if (!payslip) return res.status(404).json({ error: "Payslip not found" })

        if (req.session.role !== "ADMIN") {
            const requester = await Employee.findOne({ userId: req.session.userId }).lean()
            if (!requester || String(payslip.employeeId) !== String(requester._id)) {
                return res.status(403).json({ error: "Not authorized to view this payslip" })
            }
        }

        const employee = await Employee.findById(payslip.employeeId).lean()
        if (!employee) return res.status(404).json({ error: "Employee not found" })

        const basicSalary = payslip.basicSalary ?? 0
        const allowances  = payslip.allowances  ?? 0
        const month       = payslip.month
        const year        = payslip.year
        const weekOff     = employee.workSchedule?.weekOff ?? []

        const counts = await getMonthCounts(employee._id, month, year, weekOff)
        const taken  = await getTakenLeaveCountsForMonth(employee._id, month, year)
        const { workingDays, presentDays, absentDays, lopWorkedDays, lateDeductionDays, lateCount } = counts

        const { earnedBasic, lateAmount, lopAmount, netSalary } =
            calcSalary(basicSalary, allowances, workingDays, presentDays, lateDeductionDays)

        const weekOffLabel = weekOff.length ? weekOff.join(", ") : "Sunday"

        return res.json({
            ...payslip,
            id:          payslip._id.toString(),
            earnedBasic,
            lopAmount:   0,
            netSalary,
            workingDays,
            deductions:  lateAmount,
            employee: {
                ...employee,
                id:                employee._id.toString(),
                casualLeaves:      taken.CASUAL,
                sickLeaves:        taken.SICK,
                earnedLeaves:      taken.EARNED,
                lopLeaves:         lopWorkedDays,
                absentDays,
                presentDays,
                lateCount:         lateCount         ?? 0,
                lateDeductionDays: lateDeductionDays ?? 0,
                lateAmount,
                weekOff,
                weekOffLabel,
            },
        })

    } catch (error) {
        console.error("getPayslipById error:", error)
        return res.status(500).json({ error: "Failed to fetch payslip" })
    }
}