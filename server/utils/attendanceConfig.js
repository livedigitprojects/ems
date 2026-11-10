import AttendanceSettings from "../models/AttendanceSettings.js"
import Office             from "../models/Office.js"
import Holiday            from "../models/Holiday.js"
import { OFFICE_LOCATIONS as DEFAULT_OFFICES } from "../constants/offices.js"

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

// ─── IST date helpers ─────────────────────────────────────────────────────────

/** "YYYY-MM-DD" of the given instant, as seen in IST. */
export const toISTDateStr = (date) =>
    new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)

/** UTC instant of IST midnight for a "YYYY-MM-DD" string (how Attendance.date is stored). */
export const istMidnightFromStr = (str) => {
    const [y, m, d] = str.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - IST_OFFSET_MS)
}

// ─── Attendance settings (clock-in time + grace) ──────────────────────────────

export const DEFAULT_SETTINGS = { clockInTime: "10:00", gracePeriodMinutes: 15 }

export const getAttendanceSettings = async () => {
    const doc = await AttendanceSettings.findOneAndUpdate(
        { key: "default" },
        { $setOnInsert: { key: "default", ...DEFAULT_SETTINGS } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean()
    return {
        clockInTime:        doc.clockInTime        ?? DEFAULT_SETTINGS.clockInTime,
        gracePeriodMinutes: doc.gracePeriodMinutes ?? DEFAULT_SETTINGS.gracePeriodMinutes,
    }
}

/** Minutes after midnight (IST) after which a clock-in counts as LATE. */
export const lateCutoffMinutes = ({ clockInTime, gracePeriodMinutes }) => {
    const [h, m] = clockInTime.split(":").map(Number)
    return h * 60 + m + gracePeriodMinutes
}

/** `istDate` is a Date already shifted by +IST offset (read with getUTC*). */
export const isLateArrival = (istDate, settings) =>
    istDate.getUTCHours() * 60 + istDate.getUTCMinutes() > lateCutoffMinutes(settings)

// ─── Offices ──────────────────────────────────────────────────────────────────

// First use on an existing deployment: seed the DB from the old hardcoded list so
// employees already assigned to HYDERABAD / VIZAG keep working with no migration.
const seedOfficesIfEmpty = async () => {
    if (await Office.estimatedDocumentCount() > 0) return
    try {
        await Office.insertMany(Object.values(DEFAULT_OFFICES).map((o) => ({
            key: o.office, label: o.label,
            latitude: o.latitude, longitude: o.longitude, radiusMeters: o.radiusMeters,
        })), { ordered: false })
    } catch (err) {
        if (err?.code !== 11000 && !err?.writeErrors) throw err   // lost a seeding race — fine
    }
}

export const listOffices = async () => {
    await seedOfficesIfEmpty()
    return Office.find().sort({ label: 1 }).lean()
}

export const getOfficeByKey = async (key) => {
    if (!key) return null
    await seedOfficesIfEmpty()
    return Office.findOne({ key }).lean()
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

/** Map of "YYYY-MM-DD" → holiday name for IST days within [startUTC, endUTC). */
export const getHolidayMap = async (startUTC, endUTC) => {
    // Holidays may be stored as UTC-midnight (admin form) or IST-midnight; widen the
    // query by a day on each side and let toISTDateStr place them on the right day.
    const pad = 24 * 60 * 60 * 1000
    const docs = await Holiday.find({
        date: { $gte: new Date(startUTC.getTime() - pad), $lt: new Date(endUTC.getTime() + pad) },
    }).lean()
    const lo = toISTDateStr(startUTC)
    const hi = toISTDateStr(new Date(endUTC.getTime() - 1))
    const map = {}
    for (const h of docs) {
        const key = toISTDateStr(h.date)
        if (key >= lo && key <= hi && !map[key]) map[key] = h.name
    }
    return map
}

export const getHolidayMapForMonth = (year, month) =>
    getHolidayMap(
        new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS),
        new Date(Date.UTC(year, month,     1) - IST_OFFSET_MS),
    )

/** Holiday name if the given "YYYY-MM-DD" is a holiday, else null. */
export const getHolidayName = async (dateStr) => {
    const start = istMidnightFromStr(dateStr)
    const map   = await getHolidayMap(start, new Date(start.getTime() + 24 * 60 * 60 * 1000))
    return map[dateStr] ?? null
}