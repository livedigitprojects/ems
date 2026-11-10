import { Router } from "express"
import { protect } from "../middleware/auth.js"
import { getNotifications, getSummary, markRead, markAllRead } from "../controllers/notificationController.js"

const notificationRouter = Router()

notificationRouter.get("/",           protect, getNotifications)
notificationRouter.get("/summary",    protect, getSummary)
notificationRouter.patch("/:id/read", protect, markRead)
notificationRouter.patch("/read-all", protect, markAllRead)

export default notificationRouter