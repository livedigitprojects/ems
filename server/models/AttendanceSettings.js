import mongoose from "mongoose"

// Singleton document (key = "default") holding company-wide attendance rules.
// An employee is marked LATE when they clock in after clockInTime + gracePeriodMinutes.
const attendanceSettingsSchema = new mongoose.Schema({
    key:                { type: String, default: "default", unique: true },
    clockInTime:        { type: String, default: "10:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },   // HH:mm, IST
    gracePeriodMinutes: { type: Number, default: 15, min: 0, max: 240 },
}, { timestamps: true })

const AttendanceSettings =
    mongoose.models.AttendanceSettings || mongoose.model("AttendanceSettings", attendanceSettingsSchema)
export default AttendanceSettings