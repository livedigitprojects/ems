import Notification from "../models/Notification.js"
import User from "../models/User.js"
import Employee from "../models/Employee.js"
import Announcement from "../models/Announcement.js"
import LeaveApplication from "../models/LeaveApplication.js"
import AttendanceRegularization from "../models/AttendanceRegularization.js"
import Letter from "../models/Letter.js"

export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.session.userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()

        const unreadCount = notifications.filter(n => !n.isRead).length

        return res.json({
            data: notifications.map(n => ({ ...n, id: n._id.toString() })),
            unreadCount,
        })
    } catch (err) {
        console.error("getNotifications error:", err)
        return res.status(500).json({ error: "Failed to fetch notifications" })
    }
}

// One lightweight request for every badge (count queries only)
// GET /notifications/summary?since=ISO_DATE
export const getSummary = async (req, res) => {
    try {
        const { userId, role } = req.session
        const isAdmin = role === "ADMIN"
        const { since, regSince, leaveSince } = req.query

        // "Seen" cut-offs sent by the client. Anything created after the cut-off is "new".
        const afterFilter = (value) => {
            const d = value ? new Date(value) : null
            return d && !isNaN(d) ? { createdAt: { $gt: d } } : {}
        }
        const announcementFilter = afterFilter(since)

        const base = [
            Notification.countDocuments({ recipientId: userId, isRead: false }),
            Announcement.countDocuments(announcementFilter),
        ]

        if (isAdmin) {
            const deletedIds = await Employee.distinct("_id", { isDeleted: true })
            const notDeleted = deletedIds.length ? { employeeId: { $nin: deletedIds } } : {}

            const [unreadNotifications, unreadAnnouncements, pendingRegularizations, pendingLeaves] =
                await Promise.all([
                    ...base,
                    // Pending requests the admin hasn't looked at yet (created after the last
                    // visit to that page). They are still pending, just no longer "new".
                    AttendanceRegularization.countDocuments({ status: "PENDING", ...notDeleted, ...afterFilter(regSince) }),
                    LeaveApplication.countDocuments({ status: "PENDING", ...notDeleted, ...afterFilter(leaveSince) }),
                ])

            return res.json({
                unreadNotifications, unreadAnnouncements,
                pendingRegularizations, pendingLeaves, unreadLetters: 0,
            })
        }

        const [unreadNotifications, unreadAnnouncements, employee] = await Promise.all([
            ...base,
            Employee.findOne({ userId }).select("_id").lean(),
        ])

        const unreadLetters = employee
            ? await Letter.countDocuments({ recipientEmployeeId: employee._id, readAt: null })
            : 0

        return res.json({
            unreadNotifications, unreadAnnouncements,
            pendingRegularizations: 0, pendingLeaves: 0, unreadLetters,
        })
    } catch (err) {
        console.error("getSummary error:", err)
        return res.status(500).json({ error: "Failed to fetch summary" })
    }
}

export const markRead = async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, recipientId: req.session.userId },
            { isRead: true }
        )
        return res.json({ success: true })
    } catch (err) {
        return res.status(500).json({ error: "Failed to mark notification" })
    }
}

export const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientId: req.session.userId, isRead: false },
            { isRead: true }
        )
        return res.json({ success: true })
    } catch (err) {
        return res.status(500).json({ error: "Failed to mark all notifications" })
    }
}

// Helper used by other controllers
export const createNotification = async ({ recipientId, recipientRole, type, title, message, refId, refType }) => {
    try {
        await Notification.create({
            recipientId, recipientRole, type, title, message,
            refId: refId || null,
            refType: refType || null,
        })
    } catch (err) {
        console.error("createNotification error:", err)
    }
}

// Helper: get all admin user IDs
export const getAdminUserIds = async () => {
    const admins = await User.find({ role: "ADMIN" }).select("_id").lean()
    return admins.map(a => a._id)
}

// Helper: get every user ID (admins + employees)
export const getAllUserIds = async () => {
    const users = await User.find({}).select("_id role").lean()
    return users.map(u => ({ id: u._id, role: u.role }))
}