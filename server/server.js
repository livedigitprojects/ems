import express from "express"
import cors from "cors"
import "dotenv/config"
import helmet from "helmet"
import connectDB from "./config/db.js"
import authRouter from "./routes/authRoutes.js"
import employeeRouter from "./routes/employeeRoutes.js"
import profileRouter from "./routes/profileRoutes.js"
import attendanceRouter from "./routes/attendanceRoutes.js"
import leaveRouter from "./routes/leaveRoutes.js"
import payslipRouter from "./routes/payslipRoutes.js"
import dashboardRouter from "./routes/dashboardRoutes.js"
import announcementRouter from "./routes/announcementRoutes.js"
import holidayRouter from "./routes/holidayRoutes.js"
import regularizationRouter from "./routes/regularizationRoutes.js"
import letterRouter from "./routes/letterRoutes.js"
import { startAutoCheckoutJob } from "./jobs/autoCheckout.js"
import { startBirthdayAnnouncementJob } from "./jobs/birthdayAnnouncement.js"
import notificationRouter from "./routes/notificationRoutes.js"
import exportRouter from "./routes/exportRoutes.js"
import internalRouter from "./routes/internalRoutes.js"
import officeRouter from "./routes/officeRoutes.js"
import attendanceSettingsRouter from "./routes/attendanceSettingsRoutes.js"
import { mongoSanitizeBody } from "./middleware/mongoSanitizeBody.js"

const app = express()
app.set("trust proxy", 1)
const PORT = process.env.PORT || 4000

const allowedOrigins = [
    "https://ems-snowy-six.vercel.app",
    "https://ems.livedigit.in",
    "http://localhost:5173"
]

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error("Not allowed by CORS"))
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}

app.use(helmet())
app.use(cors(corsOptions))
app.options("/{*path}", cors(corsOptions))

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ limit: "10mb", extended: true }))
app.use(mongoSanitizeBody)

// Connect per request (cached after the first call)
app.use(async (req, res, next) => {
    try {
        await connectDB()
        next()
    } catch (err) {
        console.error("DB connection failed:", err)
        res.status(503).json({ error: "Database unavailable. Please try again." })
    }
})

app.use("/api/auth",           authRouter)
app.use("/api/employees",      employeeRouter)
app.use("/api/profile",        profileRouter)
app.use("/api/attendance",     attendanceRouter)
app.use("/api/leave",          leaveRouter)
app.use("/api/payslips",       payslipRouter)
app.use("/api/dashboard",      dashboardRouter)
app.use("/api/announcements",  announcementRouter)
app.use("/api/holidays",       holidayRouter)
app.use("/api/regularization", regularizationRouter)
app.use("/api/letters",        letterRouter)
app.use("/api/notifications",  notificationRouter)
app.use("/api/export",         exportRouter)
app.use("/api/internal",       internalRouter)
app.use("/api/offices",        officeRouter)
app.use("/api/attendance-settings", attendanceSettingsRouter)

app.get("/", (req, res) => res.send("Server running successfully"))

// Local dev / VPS only — never on Vercel
if (!process.env.VERCEL) {
    connectDB()
        .then(() => {
            startAutoCheckoutJob()
            startBirthdayAnnouncementJob()
            app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
        })
        .catch((err) => {
            console.error("Failed to start server:", err)
            process.exit(1)
        })
}

export default app