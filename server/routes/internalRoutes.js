import { Router } from "express"
import { runBirthdayAnnouncements } from "../jobs/birthdayAnnouncement.js"
import { runAutoCheckout } from "../jobs/autoCheckout.js"
import { internalLimiter } from "../middleware/rateLimiter.js"

const internalRouter = Router()
internalRouter.use(internalLimiter)

const isAuthorized = (req) => {
    const secret = process.env.CRON_SECRET
    if (!secret) return false
    return (req.headers.authorization || "") === `Bearer ${secret}`
}

internalRouter.get("/run-birthday-check", async (req, res) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" })
    try {
        await runBirthdayAnnouncements()
        return res.json({ success: true })
    } catch (err) {
        console.error("run-birthday-check error:", err)
        return res.status(500).json({ error: "Failed to run birthday check" })
    }
})

internalRouter.get("/run-auto-checkout", async (req, res) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" })
    try {
        const closed = await runAutoCheckout()
        return res.json({ success: true, closed })
    } catch (err) {
        console.error("run-auto-checkout error:", err)
        return res.status(500).json({ error: "Failed to run auto checkout" })
    }
})

export default internalRouter