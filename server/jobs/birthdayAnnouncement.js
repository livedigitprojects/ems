import cron from "node-cron"
import Employee from "../models/Employee.js"
import Announcement from "../models/Announcement.js"
import Notification from "../models/Notification.js"
import { createNotification, getAdminUserIds, getAllUserIds } from "../controllers/notificationController.js"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const WISH_MESSAGES = [
  "Wishing you a fantastic day filled with joy, laughter, and everything you love. Happy Birthday!",
  "Here's to another wonderful year ahead — have a birthday as amazing as you are!",
  "May your special day be filled with happiness, good health, and great memories. Happy Birthday!",
]

const pickWish = () => WISH_MESSAGES[Math.floor(Math.random() * WISH_MESSAGES.length)]

// Birthday announcements are only relevant for a short while: remove them (and the
// notifications that point at them) once they are a month old.
export const cleanupOldBirthdayAnnouncements = async () => {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 1)

  const old = await Announcement.find({ type: "BIRTHDAY", createdAt: { $lt: cutoff } }).select("_id").lean()
  if (!old.length) return 0

  const ids = old.map((a) => a._id)
  await Notification.deleteMany({ refType: "Announcement", refId: { $in: ids } })
  await Announcement.deleteMany({ _id: { $in: ids } })
  console.log(`[BirthdayAnnouncement] Removed ${ids.length} birthday announcement(s) older than a month`)
  return ids.length
}

// Finds every active employee whose date of birth falls on today (IST),
// posts a "🎂 Happy Birthday" announcement for each, and notifies everyone.
// Safe to run more than once a day — it skips anyone already wished today.
export const runBirthdayAnnouncements = async () => {
  // Housekeeping first, in its own try/catch so a cleanup problem never blocks today's wishes.
  try { await cleanupOldBirthdayAnnouncements() }
  catch (err) { console.error("[BirthdayAnnouncement] Cleanup failed:", err) }

  try {
    const istNow = new Date(Date.now() + IST_OFFSET_MS)
    const month  = istNow.getUTCMonth() + 1
    const day    = istNow.getUTCDate()

    const dayStartUTC = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0) - IST_OFFSET_MS)
    const dayEndUTC   = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000)

    const birthdayEmployees = await Employee.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          employmentStatus: "ACTIVE",
          dateOfBirth: { $ne: null },
          $expr: {
            $and: [
              { $eq: [{ $month: "$dateOfBirth" }, month] },
              { $eq: [{ $dayOfMonth: "$dateOfBirth" }, day] },
            ],
          },
        },
      },
    ])

    if (!birthdayEmployees.length) return

    const adminIds = await getAdminUserIds()
    if (!adminIds.length) {
      console.warn("[BirthdayAnnouncement] No admin found to attribute the announcement to — skipping")
      return
    }
    const systemAuthorId = adminIds[0]
    const allUsers = await getAllUserIds()

    for (const emp of birthdayEmployees) {
      // Idempotency: skip if we already posted a birthday announcement for
      // this employee today (handles cron restarts / multiple triggers).
      const alreadySent = await Announcement.exists({
        type: "BIRTHDAY",
        employeeId: emp._id,
        createdAt: { $gte: dayStartUTC, $lt: dayEndUTC },
      })
      if (alreadySent) continue

      const fullName = `${emp.firstName} ${emp.lastName}`.trim()
      const announcement = await Announcement.create({
        title: `🎂 Happy Birthday, ${emp.firstName}!`,
        message: `Join us in wishing ${fullName} from ${emp.department} a very happy birthday! ${pickWish()}`,
        priority: "NORMAL",
        createdBy: systemAuthorId,
        type: "BIRTHDAY",
        employeeId: emp._id,
      })

      await Promise.all(allUsers.map(({ id, role }) =>
        createNotification({
          recipientId:   id,
          recipientRole: role,
          type:          "ANNOUNCEMENT",
          title:         "🎂 New Announcement",
          message:       announcement.title,
          refId:         announcement._id,
          refType:       "Announcement",
        })
      ))

      console.log(`[BirthdayAnnouncement] Posted birthday announcement for ${fullName}`)
    }
  } catch (err) {
    console.error("[BirthdayAnnouncement] Job failed:", err)
  }
}

// Only useful on a persistent (non-serverless) server — see server.js and
// server/routes/internalRoutes.js for how this runs reliably on Vercel.
export const startBirthdayAnnouncementJob = () => {
  cron.schedule("0 9 * * *", runBirthdayAnnouncements, { timezone: "Asia/Kolkata" })
  console.log("[BirthdayAnnouncement] Cron job started — runs daily at 9:00 AM IST")
}