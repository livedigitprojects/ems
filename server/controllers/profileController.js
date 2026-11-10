import Employee from "../models/Employee.js"
import User from "../models/User.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

const mergeWithUser = (employee, user) => ({
    ...employee,
    avatar:             user?.avatar             ?? "",
    cloudinaryPublicId: user?.cloudinaryPublicId ?? "",
    user: {
        role:  user?.role  ?? "",
        email: user?.email ?? "",
    },
})

const findOrCreateEmployee = async (userId) => {
    const existing = await Employee.findOne({ userId }).lean()
    if (existing) return existing

    const user = await User.findById(userId).lean()
    if (!user) return null

    // Bypass schema validation for auto-created profiles (e.g. admin accounts
    // that were seeded without a corresponding Employee document)
    const doc = new Employee({
        userId,
        firstName:        user.email.split("@")[0],
        lastName:         "N/A",
        email:            user.email,
        phone:            "N/A",
        position:         user.role === "ADMIN" ? "Administrator" : "Employee",
        department:       "Technical",
        joinDate:         new Date(),
        employmentStatus: "ACTIVE",
    })

    await doc.save({ validateBeforeSave: false })  // ✅ skips required checks
    return doc.toObject()
}

// ── GET /api/profile ──────────────────────────────────────────────────────────

export const getProfile = async (req, res) => {
    try {
        const userId = req.session.userId  //  your JWT puts userId here

        const employee = await findOrCreateEmployee(userId)
        if (!employee) return res.status(404).json({ error: "User not found" })

        const user = await User.findById(userId)
            .select("avatar cloudinaryPublicId role email")
            .lean()

        return res.json(mergeWithUser(employee, user))
    } catch (err) {
        console.error("getProfile error:", err)
        return res.status(500).json({ error: err.message })
    }
}

// ── POST /api/profile ─────────────────────────────────────────────────────────

const ALLOWED_PROFILE_FIELDS = ["bio"]

export const updateProfile = async (req, res) => {
    try {
        const userId = req.session.userId  // ✅ your JWT puts userId here

        const updates = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => ALLOWED_PROFILE_FIELDS.includes(key))
        )

        if (!Object.keys(updates).length)
            return res.status(400).json({ error: "No valid fields to update" })

        const employee = await Employee.findOneAndUpdate(
            { userId },
            { $set: updates },
            { returnDocument: "after", runValidators: false }
        )
        if (!employee) return res.status(404).json({ error: "Profile not found" })

        return res.json({ message: "Profile updated successfully", data: employee })
    } catch (err) {
        console.error("updateProfile error:", err)
        return res.status(500).json({ error: err.message })
    }
}

// ── POST /api/profile/avatar ──────────────────────────────────────────────────

export const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file received" })

        const userId = req.session.userId  // ✅ your JWT puts userId here

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ error: "User not found" })

        if (user.cloudinaryPublicId) {
            const { cloudinary } = await import("../middleware/avatarUpload.js")
            await cloudinary.uploader.destroy(user.cloudinaryPublicId).catch((e) =>
                console.warn("Could not delete old avatar:", e.message)
            )
        }

        user.avatar             = req.file.path
        user.cloudinaryPublicId = req.file.filename
        await user.save()

        return res.json({ avatarUrl: user.avatar })
    } catch (err) {
        console.error("uploadAvatar error:", err)
        return res.status(500).json({ error: err.message })
    }
}