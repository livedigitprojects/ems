import Employee             from "../models/Employee.js"
import Attendance           from "../models/Attendance.js"
import LeaveApplication     from "../models/LeaveApplication.js"
import LateRegularization   from "../models/LateRegularization.js"
import Payslip              from "../models/Payslip.js"
import { getHolidayMapForMonth } from "../utils/attendanceConfig.js"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

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

// Working days = calendar days − weekoff occurrences. No fixed leave
// deduction — must match the same date universe payslipController uses,
// otherwise this report's presentDays/absentDays won't match the actual
// payslip for the same employee/month.
const getWorkingDays = (month, year, weekOff = []) =>
    Math.max(1, getWorkingDatesOfMonth(month, year, weekOff).length)

const toISTDateStr = (utcDate) =>
    new Date(new Date(utcDate).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)

const buildEmployeeReport = async (employee, month, year) => {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month, 0, 23, 59, 59)
    const queryStart = new Date(monthStart.getTime() - IST_OFFSET_MS)
    const queryEnd   = new Date(monthEnd.getTime()   + IST_OFFSET_MS)

    const weekOff      = employee.workSchedule?.weekOff ?? []
    // Holidays are excluded so this report matches the payslip for the same month.
    const holidayMap   = await getHolidayMapForMonth(year, month)
    const workingDates = getWorkingDatesOfMonth(month, year, weekOff).filter((d) => !holidayMap[d])
    const workingDays  = Math.max(1, workingDates.length)

    const [attendanceRecords, leaveRecords, lateRegs, payslip] = await Promise.all([
        Attendance.find({ employeeId: employee._id, date: { $gte: queryStart, $lte: queryEnd } }).lean(),
        LeaveApplication.find({
            employeeId: employee._id,
            status:     "APPROVED",
            startDate:  { $lte: monthEnd },
            endDate:    { $gte: monthStart },
        }).lean(),
        LateRegularization.find({
            employeeId: employee._id,
            status:     "APPROVED",
            date:       { $gte: queryStart, $lte: queryEnd },
        }).lean(),
        Payslip.findOne({ employeeId: employee._id, month, year }).lean(),
    ])

    // Build sets for accurate day calculation
    const clockedInDates  = new Set(attendanceRecords.map(r => toISTDateStr(r.date)))
    const lateDates       = new Set(attendanceRecords.filter(r => r.status === "LATE").map(r => toISTDateStr(r.date)))
    const lateApprDates   = new Set(lateRegs.map(r => toISTDateStr(r.date)))
    const lopDates        = new Set()
    const paidLeaveDates  = new Set()

    for (const leave of leaveRecords) {
        const start = new Date(Math.max(new Date(leave.startDate), monthStart))
        const end   = new Date(Math.min(new Date(leave.endDate),   monthEnd))
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const mm  = String(d.getMonth() + 1).padStart(2, "0")
            const dd  = String(d.getDate()).padStart(2, "0")
            const str = `${d.getFullYear()}-${mm}-${dd}`
            if (leave.type === "LOSS_OF_PAY") lopDates.add(str)
            else paidLeaveDates.add(str)
        }
    }

    const clockInDays    = workingDates.filter(d => clockedInDates.has(d)).length
    const lateDays       = workingDates.filter(d => lateDates.has(d)).length
    const lateApprDays   = workingDates.filter(d => lateApprDates.has(d)).length
    const paidLeaveDays  = workingDates.filter(d => !clockedInDates.has(d) && paidLeaveDates.has(d) && !lopDates.has(d)).length
    const lopWorkedDays  = workingDates.filter(d => !clockedInDates.has(d) && lopDates.has(d)).length

    // presentDays = clocked-in + paid leave days (SL/CL/EL)
    // Late days that are approved count as present (already included in clockInDays since attendance record exists)
    const presentDays = clockInDays + paidLeaveDays
    const absentDays  = Math.max(0, workingDays - presentDays - lopWorkedDays)

    let sickLeaves = 0, casualLeaves = 0, earnedLeaves = 0, lop = 0
    for (const leave of leaveRecords) {
        const start = new Date(Math.max(new Date(leave.startDate), monthStart))
        const end   = new Date(Math.min(new Date(leave.endDate),   monthEnd))
        const days  = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
        if      (leave.type === "SICK")        sickLeaves   += days
        else if (leave.type === "CASUAL")      casualLeaves += days
        else if (leave.type === "EARNED")      earnedLeaves += days
        else if (leave.type === "LOSS_OF_PAY") lop          += days
    }

    return {
        employeeName:      `${employee.firstName} ${employee.lastName}`,
        employeeId:        employee.employeeId || employee._id.toString(),
        officeLocation:    employee.assignedLocation?.label || employee.assignedLocation?.office || "—",
        workingDays,
        presentDays,
        lateDays,
        lateApprovedDays:  lateApprDays,
        absentDays,
        lop:               payslip?.lopDays   ?? lop,
        sickLeaves,
        casualLeaves,
        earnedLeaves,
        basicSalary:       employee.basicSalary ?? 0,
        allowances:        employee.allowances  ?? 0,
        deductions:        payslip?.lopAmount   ?? 0,
        netSalary:         payslip?.netSalary   ?? 0,
        bankName:          employee.bankDetails?.bankName          || "—",
        accountHolderName: employee.bankDetails?.accountHolderName || "—",
        accountNumber:     employee.bankDetails?.accountNumber     || "—",
        ifscCode:          employee.bankDetails?.ifscCode          || "—",
        accountType:       employee.bankDetails?.accountType       || "—",
    }
}

export const exportReport = async (req, res) => {
    try {
        const { month, year, employeeId, format = "json" } = req.query
        if (!month || !year) return res.status(400).json({ error: "month and year are required" })

        const m = parseInt(month)
        const y = parseInt(year)

        let employees
        if (employeeId) {
            const emp = await Employee.findById(employeeId).lean()
            if (!emp) return res.status(404).json({ error: "Employee not found" })
            employees = [emp]
        } else {
            employees = await Employee.find({ isDeleted: { $ne: true } }).lean()
        }

        const rows = await Promise.all(employees.map(emp => buildEmployeeReport(emp, m, y)))

        if (format === "json") {
            return res.json({ data: rows, month: m, year: y, monthName: MONTHS[m - 1] })
        }

        // CSV
        const headers = [
            "Employee Name","Employee ID","Office Location","Working Days","Present Days","Late Days","Late Approved Days","Absent Days",
            "Loss of Pay Days","Sick Leaves","Casual Leaves","Earned Leaves",
            "Basic Salary","Allowances","Deductions","Net Salary",
            "Bank Name","Account Holder","Account Number","IFSC Code","Account Type",
        ]

        const escapeCSV = (v) => {
            const s = String(v ?? "")
            return s.includes(",") || s.includes('"') || s.includes("\n")
                ? `"${s.replace(/"/g, '""')}"`
                : s
        }

        const csvRows = [
            `${MONTHS[m - 1]} ${y} - Employee Attendance & Salary Report`,
            "",
            headers.join(","),
            ...rows.map(r => [
                r.employeeName, r.employeeId, r.officeLocation,
                r.workingDays, r.presentDays, r.lateDays, r.lateApprovedDays, r.absentDays,
                r.lop, r.sickLeaves, r.casualLeaves, r.earnedLeaves,
                r.basicSalary, r.allowances, r.deductions, r.netSalary,
                r.bankName, r.accountHolderName, r.accountNumber, r.ifscCode, r.accountType,
            ].map(escapeCSV).join(","))
        ]

        const filename = employeeId
            ? `${rows[0]?.employeeId || "employee"}_${MONTHS[m-1]}_${y}.csv`
            : `all_employees_${MONTHS[m-1]}_${y}.csv`

        res.setHeader("Content-Type", "text/csv")
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
        return res.send(csvRows.join("\r\n"))
    } catch (err) {
        console.error("exportReport error:", err)
        return res.status(500).json({ error: "Failed to generate report" })
    }
}