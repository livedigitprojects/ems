import { Router } from "express"
import { protect, protectAdmin } from "../middleware/auth.js"
import { getSettings, updateSettings } from "../controllers/attendanceSettingsController.js"

const attendanceSettingsRouter = Router()

attendanceSettingsRouter.get("/", protect,               getSettings)
attendanceSettingsRouter.put("/", protect, protectAdmin, updateSettings)

export default attendanceSettingsRouter