import bcrypt            from "bcrypt"
import Attendance        from "../models/Attendance.js"
import Employee          from "../models/Employee.js"
import LeaveApplication  from "../models/LeaveApplication.js"
import User              from "../models/User.js"
import { getOfficeByKey, getHolidayMap } from "../utils/attendanceConfig.js"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Inclusive day count between two dates */
const countDays = (start, end) =>
    Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1

/**
 * Resolve assignedLocation from the request body.
 * Only the office key is persisted — coordinates live in constants/offices.js.
 */
const resolveAssignedLocation = async (assignedLocation) => {
    const key    = assignedLocation?.office || null
    const office = key ? await getOfficeByKey(key) : null
    if (!office) return { office: null, label: "" }
    return { office: office.key, label: office.label }
}

// ─── GET ALL EMPLOYEES ────────────────────────────────────────────────────────

export const getEmployee = async (req, res) => {
    try {
        const where = { isDeleted: req.query.deleted === "true" }
        if (req.query.department) where.department = req.query.department

        const employees = await Employee.find(where)
            .sort({ createdAt: -1 })
            .populate("userId", "email role avatar")
            .lean()

        const result = employees.map((emp) => ({
            ...emp,
            id:     emp._id.toString(),
            avatar: emp.userId?.avatar || "",
            user:   emp.userId ? { email: emp.userId.email, role: emp.userId.role } : null,
        }))

        return res.json(result)
    } catch (error) {
        console.error("getEmployee error:", error)
        return res.status(500).json({ error: "Failed to fetch employees" })
    }
}

// ─── GET EMPLOYEE DETAIL ──────────────────────────────────────────────────────

// export const getEmployeeDetail = async (req, res) => {
//     try {
//         const employee = await Employee.findById(req.params.id)
//             .populate("userId", "email role avatar")
//             .lean()

//         if (!employee) return res.status(404).json({ error: "Employee not found" })

        

//                 // Attendance summary
//         // PRESENT + LATE come from stored records.
//         // ABSENT is calculated: working days up to today minus days with any clock-in.
//         const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
//         const DAY_INDEX_MAP = {
//             sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
//             thursday: 4, friday: 5, saturday: 6,
//         }

//         const joinDate   = employee.joinDate ? new Date(employee.joinDate) : new Date(0)
//         const istNow     = new Date(Date.now() + IST_OFFSET_MS)
//         const todayStr   = istNow.toISOString().slice(0, 10)
//         const weekOff    = employee.workSchedule?.weekOff ?? []
//         const offIndices = weekOff.length
//             ? new Set(weekOff.map(d => DAY_INDEX_MAP[d.toLowerCase()]).filter(n => n !== undefined))
//             : new Set([0])

//         const attendanceRaw = await Attendance.find({ employeeId: employee._id }).lean()
//         const presentCount  = attendanceRaw.filter(r => r.status === "PRESENT").length
//         const lateCount     = attendanceRaw.filter(r => r.status === "LATE").length

//         const clockedDates = new Set(
//             attendanceRaw.map(r => new Date(r.date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10))
//         )

//         // Count working days from join date to today
//         let workingDayCount = 0
//         for (let d = new Date(joinDate); d.toISOString().slice(0, 10) <= todayStr; d.setDate(d.getDate() + 1)) {
//             if (!offIndices.has(d.getDay())) workingDayCount++
//         }

//         const absentCount = Math.max(0, workingDayCount - clockedDates.size)

//         const attendanceSummary = {
//             PRESENT: presentCount,
//             LATE:    lateCount,
//             ABSENT:  absentCount,
//         }

//         // Leave summary
//         const now        = new Date()
//         const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
//         const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

//         const allApprovedLeaves = await LeaveApplication.find({
//             employeeId: employee._id,
//             status:     "APPROVED",
//         }).lean()

//         const leaveSummary = { SICK: 0, CASUAL: 0, EARNED: 0, LOSS_OF_PAY: 0 }
//         for (const leave of allApprovedLeaves) {
//             if (leave.type === "LOSS_OF_PAY") {
//                 const start = new Date(Math.max(new Date(leave.startDate), monthStart))
//                 const end   = new Date(Math.min(new Date(leave.endDate),   monthEnd))
//                 if (end >= start) leaveSummary.LOSS_OF_PAY += countDays(start, end)
//             } else if (leave.type in leaveSummary) {
//                 leaveSummary[leave.type] += countDays(leave.startDate, leave.endDate)
//             }
//         }

//         return res.json({
//             ...employee,
//             id:     employee._id.toString(),
//             avatar: employee.userId?.avatar || "",
//             user:   employee.userId ? { email: employee.userId.email, role: employee.userId.role } : null,
//             attendanceSummary,
//             leaveSummary,
//         })
//     } catch (error) {
//         console.error("getEmployeeDetail error:", error.message)
//         return res.status(500).json({ error: error.message })
//     }
// }

export const getEmployeeDetail = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id)
            .populate("userId", "email role avatar")
            .lean()

        if (!employee) return res.status(404).json({ error: "Employee not found" })

        // ── Attendance summary — CURRENT MONTH ONLY ───────────────────────────
        const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
        const DAY_INDEX_MAP = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 }

        const istNow   = new Date(Date.now() + IST_OFFSET_MS)
        const todayStr = istNow.toISOString().slice(0, 10)
        const curYear  = istNow.getUTCFullYear()
        const curMonth = istNow.getUTCMonth() // 0-indexed

        // Month boundaries in UTC (accounting for IST offset)
        const monthStartUTC = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0) - IST_OFFSET_MS)
        const monthEndUTC   = new Date(Date.UTC(curYear, curMonth + 1, 1, 0, 0, 0) - IST_OFFSET_MS)

        const weekOff    = employee.workSchedule?.weekOff ?? []
        const offIndices = weekOff.length
            ? new Set(weekOff.map(d => DAY_INDEX_MAP[d.toLowerCase()]).filter(n => n !== undefined))
            : new Set([0])

        // Only this month's attendance records
        const monthRecords = await Attendance.find({
            employeeId: employee._id,
            date: { $gte: monthStartUTC, $lt: monthEndUTC },
        }).lean()

        const presentCount = monthRecords.filter(r => r.status === "PRESENT").length
        const lateCount    = monthRecords.filter(r => r.status === "LATE").length

        // Dates clocked in this month
        const clockedThisMonth = new Set(
            monthRecords.map(r => new Date(r.date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10))
        )

        // Company holidays this month — never counted as working days / absences
        const holidayMap = await getHolidayMap(monthStartUTC, monthEndUTC)

        // Count working days this month up to today (excluding week-offs and holidays)
        let workingDayCount = 0
        const monthStart = new Date(Date.UTC(curYear, curMonth, 1))
        for (let d = new Date(monthStart); d.toISOString().slice(0, 10) <= todayStr; d.setUTCDate(d.getUTCDate() + 1)) {
            const istD = new Date(d.getTime() + IST_OFFSET_MS)
            if (offIndices.has(istD.getUTCDay())) continue
            if (holidayMap[d.toISOString().slice(0, 10)]) continue
            workingDayCount++
        }

        // A day worked on a holiday was already removed from workingDayCount, so it
        // must not also be subtracted as "clocked in".
        const clockedWorkingDays = [...clockedThisMonth].filter(
            (s) => !holidayMap[s] && !offIndices.has(new Date(s + "T00:00:00Z").getUTCDay())
        ).length
        const absentCount = Math.max(0, workingDayCount - clockedWorkingDays)

        const attendanceSummary = {
            PRESENT: presentCount,
            LATE:    lateCount,
            ABSENT:  absentCount,
        }

        // ── Leave summary — CURRENT MONTH ONLY ───────────────────────────────
        const now        = new Date()
        const mthStart   = new Date(now.getFullYear(), now.getMonth(), 1)
        const mthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const allApprovedLeaves = await LeaveApplication.find({
            employeeId: employee._id,
            status:     "APPROVED",
            startDate:  { $lte: mthEnd },
            endDate:    { $gte: mthStart },
        }).lean()

        const leaveSummary = { SICK: 0, CASUAL: 0, EARNED: 0, LOSS_OF_PAY: 0 }
        for (const leave of allApprovedLeaves) {
            const start = new Date(Math.max(new Date(leave.startDate), mthStart))
            const end   = new Date(Math.min(new Date(leave.endDate),   mthEnd))
            if (end >= start && leave.type in leaveSummary) {
                leaveSummary[leave.type] += countDays(start, end)
            }
        }

        return res.json({
            ...employee,
            id:     employee._id.toString(),
            avatar: employee.userId?.avatar || "",
            user:   employee.userId ? { email: employee.userId.email, role: employee.userId.role } : null,
            attendanceSummary,
            leaveSummary,
        })
    } catch (error) {
        console.error("getEmployeeDetail error:", error.message)
        return res.status(500).json({ error: error.message })
    }
}

// ─── CREATE EMPLOYEE ──────────────────────────────────────────────────────────

export const createEmployee = async (req, res) => {
    try {
        const {
            employeeId, bloodGroup,
            firstName, lastName, email, phone, position, department,
            basicSalary, allowances, deductions, joinDate, dateOfBirth, password, role, bio,
            accountHolderName, bankName, accountNumber, ifscCode, accountType,
            workSchedule, assignedLocation,
        } = req.body

        if (!email || !password || !firstName || !lastName)
            return res.status(400).json({ error: "Missing required fields" })

        // ── Auto-generate employeeId if not supplied ──────────────────────────
let finalEmployeeId = (employeeId || "").trim()
if (!finalEmployeeId) {
    const count = await Employee.countDocuments()
    finalEmployeeId = `LD${String(count + 1).padStart(3, "0")}`
}

const hashed = await bcrypt.hash(password, 10)
const user   = await User.create({ email, password: hashed, role: role || "EMPLOYEE" })

        let employee
        try {
            employee = await Employee.create({
                userId:      user._id,
                employeeId:  finalEmployeeId,   // ← use resolved ID
                bloodGroup:  bloodGroup || "",
                firstName,   lastName,  email,  phone,
                position,
                department:  department  || "Technical",
                basicSalary: Number(basicSalary) || 0,
                allowances:  Number(allowances)  || 0,
                deductions:  Number(deductions)  || 0,
                joinDate:    new Date(joinDate),
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                bio:         bio || "",
                bankDetails: {
                    accountHolderName: accountHolderName || "",
                    bankName:          bankName          || "",
                    accountNumber:     accountNumber     || "",
                    ifscCode:          ifscCode          || "",
                    accountType:       accountType       || "",
                },
                workSchedule: {
                    shiftStart: workSchedule?.shiftStart || "",
                    shiftEnd:   workSchedule?.shiftEnd   || "",
                    breakStart: workSchedule?.breakStart || "",
                    breakEnd:   workSchedule?.breakEnd   || "",
                    lunchStart: workSchedule?.lunchStart || "",
                    lunchEnd:   workSchedule?.lunchEnd   || "",
                    weekOff:    workSchedule?.weekOff    ?? ["Saturday", "Sunday"],
                },
                assignedLocation: await resolveAssignedLocation(assignedLocation),
            })
        } catch (employeeError) {
            // Employee.create failed (e.g. duplicate employeeId) — the User
            // document above was already persisted. Without this rollback it
            // becomes an orphan that permanently locks this email, since
            // User.email is unique and there's no Employee record left to
            // show why. Roll it back so the admin can simply retry.
            await User.findByIdAndDelete(user._id)
            throw employeeError
        }

        return res.status(201).json({ success: true, employee: employee.toObject() })
    } catch (error) {
        if (error.code === 11000) {
            const field = error.keyPattern?.employeeId ? "Employee ID" : "Email"
            return res.status(400).json({ error: `${field} already exists` })
        }
        console.error("createEmployee error:", error.message)
        return res.status(500).json({ error: error.message })
    }
}

// ─── UPDATE EMPLOYEE ──────────────────────────────────────────────────────────

export const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params
        const {
            employeeId, bloodGroup,
            firstName, lastName, email, phone, position, department,
            basicSalary, allowances, deductions, employmentStatus, password, role, bio, dateOfBirth,
            accountHolderName, bankName, accountNumber, ifscCode, accountType,
            workSchedule, assignedLocation,
        } = req.body

        const employee = await Employee.findById(id)
        if (!employee) return res.status(404).json({ error: "Employee not found" })

        await Employee.findByIdAndUpdate(id, {
            employeeId:       employeeId       || "",
            bloodGroup:       bloodGroup       || "",
            firstName,        lastName,        email,  phone,  position,
            department:       department       || "Technical",
            basicSalary:      Number(basicSalary) || 0,
            allowances:       Number(allowances)  || 0,
            deductions:       Number(deductions)  || 0,
            employmentStatus: employmentStatus || "ACTIVE",
            bio:              bio              || "",
            dateOfBirth:      dateOfBirth ? new Date(dateOfBirth) : null,
            bankDetails: {
                accountHolderName: accountHolderName || "",
                bankName:          bankName          || "",
                accountNumber:     accountNumber     || "",
                ifscCode:          ifscCode          || "",
                accountType:       accountType       || "",
            },
            workSchedule: {
                shiftStart: workSchedule?.shiftStart || "",
                shiftEnd:   workSchedule?.shiftEnd   || "",
                breakStart: workSchedule?.breakStart || "",
                breakEnd:   workSchedule?.breakEnd   || "",
                lunchStart: workSchedule?.lunchStart || "",
                lunchEnd:   workSchedule?.lunchEnd   || "",
                weekOff:    workSchedule?.weekOff    || ["Saturday", "Sunday"],
            },
            assignedLocation: await resolveAssignedLocation(assignedLocation),
        })

        const userUpdate = { email }
        if (role)     userUpdate.role     = role
        if (password) userUpdate.password = await bcrypt.hash(password, 10)
        await User.findByIdAndUpdate(employee.userId, userUpdate)

        return res.json({ success: true })
    } catch (error) {
        if (error.code === 11000) {
            const field = error.keyPattern?.employeeId ? "Employee ID" : "Email"
            return res.status(400).json({ error: `${field} already exists` })
        }
        console.error("updateEmployee error:", error.message)
        return res.status(500).json({ error: error.message })
    }
}

// ─── DELETE EMPLOYEE ──────────────────────────────────────────────────────────

export const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id)
        if (!employee) return res.status(404).json({ error: "Employee not found" })

        employee.isDeleted        = true
        employee.employmentStatus = "INACTIVE"
        await employee.save()

        return res.json({ success: true })
    } catch (error) {
        console.error("deleteEmployee error:", error.message)
        return res.status(500).json({ error: error.message })
    }
}

// ─── ADMIN RESTORE EMPLOYEE ───────────────────────────────────────────────────

export const restoreEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id)
        if (!employee) return res.status(404).json({ error: "Employee not found" })

        employee.isDeleted        = false
        employee.employmentStatus = "ACTIVE"
        await employee.save()

        return res.json({ success: true })
    } catch (error) {
        console.error("restoreEmployee error:", error.message)
        return res.status(500).json({ error: error.message })
    }
}


// ─── ADMIN RESET EMPLOYEE PASSWORD ───────────────────────────────────────────

export const resetEmployeePassword = async (req, res) => {
    try {
        const { newPassword } = req.body
        if (typeof newPassword !== "string" || newPassword.length < 6)
            return res.status(400).json({ error: "New password must be at least 6 characters" })
        if (newPassword.length > 72)   // bcrypt ignores anything past 72 bytes
            return res.status(400).json({ error: "New password must be 72 characters or fewer" })

        const employee = await Employee.findById(req.params.id).lean()
        if (!employee || !employee.userId) return res.status(404).json({ error: "Employee not found" })

        const hashed = await bcrypt.hash(newPassword, 10)
        await User.findByIdAndUpdate(employee.userId, { password: hashed })

        return res.json({ success: true, message: "Password reset successfully" })
    } catch (error) {
        console.error("resetEmployeePassword error:", error.message)
        return res.status(500).json({ error: error.message })
    }
}