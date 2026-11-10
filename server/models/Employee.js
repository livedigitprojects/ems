
import mongoose from "mongoose"
import { DEPARTMENTS } from "../constants/departments.js"

const employeeSchema = new mongoose.Schema({
    userId:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // ── Identity ──────────────────────────────────────────────────────────────
    employeeId:       { type: String, default: "", unique: true, sparse: true },
    bloodGroup:       { type: String, default: "", enum: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },

    // ── Personal ──────────────────────────────────────────────────────────────
    firstName:        { type: String, required: true },
    lastName:         { type: String, required: true },
    email:            { type: String, required: true },
    phone:            { type: String, required: true },
    position:         { type: String, required: true },
    department:       { type: String, enum: DEPARTMENTS, default: "Technical" },
    bio:              { type: String, default: "" },
    dateOfBirth:      { type: Date, default: null },
    joinDate:         { type: Date, required: true },
    employmentStatus: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    isDeleted:        { type: Boolean, default: false },

    // ── Salary ────────────────────────────────────────────────────────────────
    basicSalary:      { type: Number, default: 0 },
    allowances:       { type: Number, default: 0 },
    deductions:       { type: Number, default: 0 },

    // ── Bank Details ──────────────────────────────────────────────────────────
    bankDetails: {
        accountHolderName: { type: String, default: "" },
        bankName:          { type: String, default: "" },
        accountNumber:     { type: String, default: "" },
        ifscCode:          { type: String, default: "" },
        accountType:       { type: String, default: "" },
    },

    // ── Work Schedule ─────────────────────────────────────────────────────────
    workSchedule: {
        shiftStart: { type: String, default: "" },
        shiftEnd:   { type: String, default: "" },
        breakStart: { type: String, default: "" },
        breakEnd:   { type: String, default: "" },
        lunchStart: { type: String, default: "" },
        lunchEnd:   { type: String, default: "" },
        weekOff:    { type: [String], default: ["Saturday", "Sunday"] },
    },

    // ── Geofencing ────────────────────────────────────────────────────────────
    // Only store the office key (e.g. "HYDERABAD").
    // Coordinates are resolved at runtime from the Office collection
    // (managed by admins) — never stored here, so there's a single source of truth.
    assignedLocation: {
        office: { type: String, default: null },
        label:  { type: String, default: "" },
    },

}, { timestamps: true })

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema)

export default Employee