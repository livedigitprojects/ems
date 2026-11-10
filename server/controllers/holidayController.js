// controllers/holidayController.js
import Holiday from "../models/Holiday.js"
import { toISTDateStr } from "../utils/attendanceConfig.js"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Holidays are stored as UTC-midnight of the calendar date the admin picked
// (the existing convention the calendar page relies on). Attendance logic always
// resolves them back to a calendar day with toISTDateStr(), which is stable for
// both UTC-midnight and IST-midnight values.
const parseDate = (value) => {
  const str = String(value ?? "").slice(0, 10)
  if (!DATE_RE.test(str)) return null
  const d = new Date(`${str}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== str ? null : d
}

const findOnSameDay = async (date, excludeId) => {
  const key  = toISTDateStr(date)
  const pad  = 24 * 60 * 60 * 1000
  const near = await Holiday.find({ date: { $gte: new Date(date.getTime() - pad), $lte: new Date(date.getTime() + pad) } }).lean()
  return near.find((h) => toISTDateStr(h.date) === key && String(h._id) !== String(excludeId))
}

export const getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 })
    res.json(holidays)
  } catch (error) {
    console.error("getHolidays error:", error)
    res.status(500).json({ message: "Failed to fetch holidays", error: error.message })
  }
}

export const createHoliday = async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim()
    const date = parseDate(req.body.date)
    if (!date || !name)
      return res.status(400).json({ message: "A valid date (YYYY-MM-DD) and name are required" })

    const clash = await findOnSameDay(date)
    if (clash) return res.status(409).json({ message: `${clash.name} is already marked on this date` })

    const holiday = await Holiday.create({ date, name })
    res.status(201).json(holiday)
  } catch (error) {
    console.error("createHoliday error:", error)
    res.status(500).json({ message: "Failed to create holiday", error: error.message })
  }
}

export const updateHoliday = async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim()
    const date = parseDate(req.body.date)
    if (!date || !name)
      return res.status(400).json({ message: "A valid date (YYYY-MM-DD) and name are required" })

    const clash = await findOnSameDay(date, req.params.id)
    if (clash) return res.status(409).json({ message: `${clash.name} is already marked on this date` })

    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      { date, name },
      { returnDocument: "after", runValidators: true }
    )
    if (!holiday) return res.status(404).json({ message: "Holiday not found" })
    res.json(holiday)
  } catch (error) {
    console.error("updateHoliday error:", error)
    res.status(500).json({ message: "Failed to update holiday", error: error.message })
  }
}

export const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id)
    if (!holiday) return res.status(404).json({ message: "Holiday not found" })
    res.json({ message: "Holiday deleted" })
  } catch (error) {
    console.error("deleteHoliday error:", error)
    res.status(500).json({ message: "Failed to delete holiday", error: error.message })
  }
}