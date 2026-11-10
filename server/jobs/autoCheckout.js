import cron       from "node-cron"
import Attendance from "../models/Attendance.js"

const MAX_HOURS      = 9
const EXPECTED_HOURS = 9
const MAX_MS         = MAX_HOURS * 60 * 60 * 1000

const getDayType = (hours) => {
    if (hours >= EXPECTED_HOURS)        return "Full Day"
    if (hours >= EXPECTED_HOURS * 0.75) return "Three Quarter Day"
    if (hours >= EXPECTED_HOURS * 0.5)  return "Half Day"
    return "Short Day"
}

export const runAutoCheckout = async () => {
    try {
        const cutoff = new Date(Date.now() - MAX_MS)

        const result = await Attendance.updateMany(
            { checkOut: null, checkIn: { $ne: null, $lte: cutoff } },
            [
                {
                    $set: {
                        checkOut:     { $add: ["$checkIn", MAX_MS] },
                        workingHours: MAX_HOURS,
                        dayType:      getDayType(MAX_HOURS),
                        status: {
                            $cond: [{ $eq: ["$status", "LATE"] }, "LATE", "PRESENT"],
                        },
                    },
                },
            ],
            { updatePipeline: true }   // Mongoose 9 requires this opt-in for aggregation-pipeline updates
        )

        const n = result.modifiedCount ?? 0
        if (n) console.log(`[AutoCheckout] Closed ${n} stale attendance record(s)`)
        return n
    } catch (err) {
        console.error("[AutoCheckout] Job failed:", err)
        throw err
    }
}

// Local dev / VPS only. On Vercel this is not started (see vercel.json cron).
export const startAutoCheckoutJob = () => {
    cron.schedule("*/15 * * * *", () => { runAutoCheckout().catch(() => {}) })
    console.log("[AutoCheckout] Cron job started — auto checkout after", MAX_HOURS, "hours")
}