import mongoose from "mongoose"

const regularizationSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: { type: Date, required: true },
    reason: {
      type: String,
      enum: ["FORGOT_TO_CHECKIN", "SYSTEM_ERROR", "WORKED_FROM_HOME", "CLIENT_VISIT", "OTHER"],
      required: true,
    },
    remarks: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    adminRemark: { type: String, default: "" },
  },
  { timestamps: true }
)

// One regularization per employee per date
regularizationSchema.index({ employeeId: 1, date: 1 }, { unique: true })

// NEW: fast "pending regularizations" count / list
regularizationSchema.index({ status: 1, createdAt: -1 })

const AttendanceRegularization =
  mongoose.models.AttendanceRegularization ||
  mongoose.model("AttendanceRegularization", regularizationSchema)

export default AttendanceRegularization