import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
    employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date:         { type: Date, required: true },
    checkIn:      { type: Date, default: null },
    checkOut:     { type: Date, default: null },
    status:       { type: String, enum: ["PRESENT", "ABSENT", "LATE"], default: "PRESENT" },
    workingHours: { type: Number, default: null },
    dayType:      { type: String, enum: ["Full Day", "Three Quarter Day", "Half Day", "Short Day", "null"], default: null },

    // ── Location logs ─────────────────────────────────────────────────────────
    checkInLocation: {
        latitude:  { type: Number, default: null },
        longitude: { type: Number, default: null },
    },
    checkOutLocation: {
        latitude:  { type: Number, default: null },
        longitude: { type: Number, default: null },
    },

}, { timestamps: true })

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true })

// NEW: lets the auto-checkout job find open records without scanning the whole collection
attendanceSchema.index({ checkOut: 1, checkIn: 1 })

const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema)

export default Attendance