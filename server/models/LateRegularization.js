import mongoose from "mongoose"

const lateRegularizationSchema = new mongoose.Schema({
    employeeId:  { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date:        { type: Date, required: true },
    reason:      { type: String, required: true },
    remarks:     { type: String, default: "" },
    status:      { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    adminRemark: { type: String, default: "" },
}, { timestamps: true })

lateRegularizationSchema.index({ employeeId: 1, date: 1 }, { unique: true })

// NEW: fast "pending late regularizations" list
lateRegularizationSchema.index({ status: 1, createdAt: -1 })

const LateRegularization =
    mongoose.models.LateRegularization ||
    mongoose.model("LateRegularization", lateRegularizationSchema)

export default LateRegularization