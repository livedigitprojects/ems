import AttendanceSettings from "../models/AttendanceSettings.js"
import { getAttendanceSettings } from "../utils/attendanceConfig.js"

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const getSettings = async (req, res) => {
    try {
        return res.json({ data: await getAttendanceSettings() })
    } catch (err) {
        console.error("getSettings error:", err)
        return res.status(500).json({ error: "Failed to fetch attendance settings" })
    }
}

export const updateSettings = async (req, res) => {
    try {
        const { clockInTime, gracePeriodMinutes } = req.body
        const update = {}

        if (clockInTime !== undefined) {
            if (!TIME_RE.test(clockInTime))
                return res.status(400).json({ error: "Clock-in time must be in HH:mm (24-hour) format" })
            update.clockInTime = clockInTime
        }
        if (gracePeriodMinutes !== undefined) {
            const g = Number(gracePeriodMinutes)
            if (!Number.isInteger(g) || g < 0 || g > 240)
                return res.status(400).json({ error: "Grace period must be a whole number of minutes between 0 and 240" })
            update.gracePeriodMinutes = g
        }
        if (!Object.keys(update).length)
            return res.status(400).json({ error: "Nothing to update" })

        await AttendanceSettings.findOneAndUpdate(
            { key: "default" }, { $set: update }, { upsert: true, setDefaultsOnInsert: true }
        )
        return res.json({ data: await getAttendanceSettings() })
    } catch (err) {
        console.error("updateSettings error:", err)
        return res.status(500).json({ error: "Failed to update attendance settings" })
    }
}