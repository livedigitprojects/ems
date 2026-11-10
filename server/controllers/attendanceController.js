import Attendance          from "../models/Attendance.js"
import Employee            from "../models/Employee.js"
import { getAttendanceSettings, getOfficeByKey, isLateArrival, getHolidayName, toISTDateStr } from "../utils/attendanceConfig.js"

// ─── Config ───────────────────────────────────────────────────────────────────

const EXPECTED_HOURS = 9
const IST_OFFSET_MS  = (5 * 60 + 30) * 60 * 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toRad = (deg) => (deg * Math.PI) / 180

const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R    = 6371000
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a    =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const toIST = (date) => new Date(date.getTime() + IST_OFFSET_MS)

const getISTMidnight = (date) => {
    const ist = toIST(date)
    ist.setUTCHours(0, 0, 0, 0)
    return new Date(ist.getTime() - IST_OFFSET_MS)
}

const getDayType = (hours) => {
    if (hours >= EXPECTED_HOURS)        return "Full Day"
    if (hours >= EXPECTED_HOURS * 0.75) return "Three Quarter Day"
    if (hours >= EXPECTED_HOURS * 0.5)  return "Half Day"
    return "Short Day"
}

const parseCoords = (body) => {
    const lat      = parseFloat(body?.latitude)
    const lng      = parseFloat(body?.longitude)
    const accuracy = parseFloat(body?.accuracy)
    if (isNaN(lat) || isNaN(lng)) return null
    return { lat, lng, accuracy: isNaN(accuracy) ? null : accuracy }
}

// ─── Clock In / Out ───────────────────────────────────────────────────────────

export const clockInOut = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.session.userId })
        if (!employee)          return res.status(404).json({ error: "Employee not found" })
        if (employee.isDeleted) return res.status(403).json({ error: "Your account is deactivated. You cannot clock in/out." })

        const officeKey = employee.assignedLocation?.office
        const loc       = officeKey ? await getOfficeByKey(officeKey) : null

        // Assigned to an office that no longer exists: fail closed rather than silently
        // skipping the geofence check.
        if (officeKey && !loc)
            return res.status(400).json({ error: "Your assigned office location is no longer configured. Please contact your admin." })

        const coords = parseCoords(req.body)

        if (!coords)
            return res.status(400).json({ error: "Location data is required to clock in/out." })

        // Only enforce geofencing when the employee has an assigned office.
        // Employees with no assigned location (remote/unassigned) can clock in
        // from anywhere — their coordinates are still recorded, just not checked.
        if (loc) {
            if (coords.accuracy !== null && coords.accuracy > loc.radiusMeters) {
                return res.status(400).json({
                    error:    `GPS accuracy too low (${Math.round(coords.accuracy)}m). Move to an open area and try again.`,
                    accuracy: Math.round(coords.accuracy),
                    required: loc.radiusMeters,
                })
            }

            const distance = getDistanceMeters(coords.lat, coords.lng, loc.latitude, loc.longitude)

            if (distance > loc.radiusMeters) {
                return res.status(403).json({
                    error:    `You are ${Math.round(distance)}m away from ${loc.label}. You must be within ${loc.radiusMeters}m to clock in/out.`,
                    distance: Math.round(distance),
                    allowed:  loc.radiusMeters,
                })
            }
        }

        return await processClockInOut(req, res, employee, coords)

    } catch (err) {
        console.error("clockInOut error:", err)
        return res.status(500).json({ error: "Operation failed" })
    }
}

const processClockInOut = async (req, res, employee, coords) => {
    const now      = new Date()
    const todayIST = getISTMidnight(now)
    const existing = await Attendance.findOne({ employeeId: employee._id, date: todayIST })

    // ── Check In ──────────────────────────────────────────────────────────────
    if (!existing) {
        const attendance = await Attendance.create({
            employeeId: employee._id,
            date:       todayIST,
            checkIn:    now,
            status:     isLateArrival(toIST(now), await getAttendanceSettings()) ? "LATE" : "PRESENT",
            checkInLocation: { latitude: coords.lat, longitude: coords.lng },
        })
        return res.json({ success: true, type: "CHECK_IN", data: attendance })
    }

    // ── Check Out ─────────────────────────────────────────────────────────────
    if (!existing.checkOut) {
        const workingHours = parseFloat(
            ((now - new Date(existing.checkIn)) / (1000 * 60 * 60)).toFixed(2)
        )

        existing.checkOut         = now
        existing.workingHours     = workingHours
        existing.dayType          = getDayType(workingHours)
        existing.checkOutLocation = { latitude: coords.lat, longitude: coords.lng }

        if (existing.status !== "LATE") {
            existing.status = workingHours >= EXPECTED_HOURS * 0.5 ? "PRESENT" : "LATE"
        }

        await existing.save()
        return res.json({ success: true, type: "CHECK_OUT", data: existing })
    }

    return res.status(400).json({ error: "Already checked out for today" })
}

// ─── Get Attendance ───────────────────────────────────────────────────────────

export const getAttendance = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.session.userId })
        if (!employee) return res.status(404).json({ error: "Employee not found" })

        const now = new Date()

        //  Compute start-of-month in IST, then convert back to UTC for the query
        // e.g. June 1 00:00 IST = May 31 18:30 UTC — matches how `date` is stored
        const istNow          = toIST(now)
        const startOfMonthIST = new Date(
            Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1, 0, 0, 0, 0) - IST_OFFSET_MS
        )

        const history = await Attendance
            .find({ employeeId: employee._id, date: { $gte: startOfMonthIST } })
            .sort({ date: -1 })


        console.log("startOfMonthIST:", startOfMonthIST)
console.log("records found:", history.length)

        return res.json({ data: history, employee: { isDeleted: employee.isDeleted } })

    } catch (err) {
        console.error("getAttendance error:", err)
        return res.status(500).json({ error: "Failed to fetch attendance" })
    }
}

// ─── Attendance Summary (admin) ───────────────────────────────────────────────

export const getAttendanceSummary = async (req, res) => {
    try {
        const { employeeId, month, year } = req.query
        if (!employeeId || !month || !year)
            return res.status(400).json({ error: "employeeId, month and year are required" })

        const m       = Number(month)
        const y       = Number(year)
        const records = await Attendance.find({
            employeeId,
            date: {
                $gte: new Date(y, m - 1, 1),
                $lte: new Date(y, m, 0, 23, 59, 59),
            },
        })

        const present = records.filter((r) => r.status === "PRESENT").length
        const late    = records.filter((r) => r.status === "LATE").length
        const absent  = records.filter((r) => r.status === "ABSENT").length

        return res.json({ daysWorked: present + late, present, late, absent, total: records.length })

    } catch (err) {
        console.error("getAttendanceSummary error:", err)
        return res.status(500).json({ error: "Failed to fetch attendance summary" })
    }
}

// ─── Today's Attendance (admin) ───────────────────────────────────────────────

export const getTodayAttendance = async (req, res) => {
    try {
        const now         = new Date()
        const todayIST    = getISTMidnight(now)
        const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000)

        const records = await Attendance
            .find({ date: { $gte: todayIST, $lt: tomorrowIST } })
            .populate("employeeId", "firstName lastName position department")
            .sort({ checkIn: 1 })
            .lean()

        const data = records
            .filter((r) => r.employeeId)
            .map((r)    => ({ ...r, _id: r._id.toString(), employee: r.employeeId }))

        return res.json({ data })

    } catch (err) {
        console.error("getTodayAttendance error:", err)
        return res.status(500).json({ error: "Failed to fetch today's attendance" })
    }
}

// ─── Today's Absent Employees (admin) ────────────────────────────────────────
export const getTodayAbsent = async (req, res) => {
    try {
        const now         = new Date()
        const todayIST    = getISTMidnight(now)
        const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000)

        // A company holiday is never an absence — nobody is expected to clock in.
        const holidayName = await getHolidayName(toISTDateStr(now))
        if (holidayName)
            return res.json({ data: [], date: todayIST, isHoliday: true, holidayName })

        // Get IDs of employees who have clocked in today
        const presentRecords = await Attendance
            .find({ date: { $gte: todayIST, $lt: tomorrowIST } })
            .select("employeeId")
            .lean()

        const presentIds = new Set(presentRecords.map((r) => r.employeeId.toString()))

        // All active employees not in that set
        const allEmployees = await Employee
            .find({ isDeleted: { $ne: true } })
            .select("firstName lastName position department employeeId")
            .lean()

        const absentEmployees = allEmployees
            .filter((e) => !presentIds.has(e._id.toString()))
            .map((e)    => ({ ...e, _id: e._id.toString() }))

        return res.json({ data: absentEmployees, date: todayIST })

    } catch (err) {
        console.error("getTodayAbsent error:", err)
        return res.status(500).json({ error: "Failed to fetch absent employees" })
    }
}