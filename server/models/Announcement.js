import mongoose from "mongoose"

const announcementSchema = new mongoose.Schema({
    title:     { type: String, required: true },
    message:   { type: String, required: true },
    imageUrl:  { type: String, default: "" },        // Cloudinary / base64 URL
    priority:  { type: String, enum: ["NORMAL", "IMPORTANT", "URGENT"], default: "NORMAL" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type:       { type: String, enum: ["GENERAL", "BIRTHDAY"], default: "GENERAL" },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
}, { timestamps: true })

// NEW: fast "newest first" list and "count since" queries
announcementSchema.index({ createdAt: -1 })

const Announcement = mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema)

export default Announcement