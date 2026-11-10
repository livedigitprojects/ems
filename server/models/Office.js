import mongoose from "mongoose"

// Admin-managed office locations used for geofenced clock-in.
// `key` is the stable identifier stored on Employee.assignedLocation.office
// (e.g. "HYDERABAD"). It is generated once from the label and never changes,
// so renaming an office never orphans employees assigned to it.
const officeSchema = new mongoose.Schema({
    key:          { type: String, required: true, unique: true, uppercase: true, trim: true },
    label:        { type: String, required: true, trim: true },
    latitude:     { type: Number, required: true, min: -90,  max: 90  },
    longitude:    { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: { type: Number, required: true, min: 10,   max: 5000, default: 150 },
}, { timestamps: true })

const Office = mongoose.models.Office || mongoose.model("Office", officeSchema)
export default Office