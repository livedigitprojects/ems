import Office   from "../models/Office.js"
import Employee from "../models/Employee.js"
import { listOffices } from "../utils/attendanceConfig.js"

const parseFields = (body, { partial = false } = {}) => {
    const out = {}
    if (body.label !== undefined || !partial) {
        const label = String(body.label ?? "").trim()
        if (!label) return { error: "Office name is required" }
        out.label = label
    }
    const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v))
    if (body.latitude !== undefined || !partial) {
        const lat = num(body.latitude)
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { error: "Latitude must be between -90 and 90" }
        out.latitude = lat
    }
    if (body.longitude !== undefined || !partial) {
        const lng = num(body.longitude)
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { error: "Longitude must be between -180 and 180" }
        out.longitude = lng
    }
    if (body.radiusMeters !== undefined || !partial) {
        const r = num(body.radiusMeters)
        if (!Number.isFinite(r) || r < 10 || r > 5000) return { error: "Radius must be between 10 and 5000 meters" }
        out.radiusMeters = Math.round(r)
    }
    return { data: out }
}

const makeKey = async (label) => {
    const base = label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "OFFICE"
    let key = base, i = 2
    while (await Office.exists({ key })) key = `${base}_${i++}`
    return key
}

export const getOffices = async (req, res) => {
    try {
        return res.json({ data: await listOffices() })
    } catch (err) {
        console.error("getOffices error:", err)
        return res.status(500).json({ error: "Failed to fetch offices" })
    }
}

export const createOffice = async (req, res) => {
    try {
        await listOffices() // make sure defaults are seeded before the first custom office
        const { data, error } = parseFields(req.body)
        if (error) return res.status(400).json({ error })

        if (await Office.exists({ label: new RegExp(`^${data.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }))
            return res.status(409).json({ error: "An office with this name already exists" })

        const office = await Office.create({ ...data, key: await makeKey(data.label) })
        return res.status(201).json({ data: office })
    } catch (err) {
        console.error("createOffice error:", err)
        return res.status(500).json({ error: "Failed to create office" })
    }
}

export const updateOffice = async (req, res) => {
    try {
        const { data, error } = parseFields(req.body, { partial: true })
        if (error) return res.status(400).json({ error })

        const office = await Office.findById(req.params.id)
        if (!office) return res.status(404).json({ error: "Office not found" })

        Object.assign(office, data)
        await office.save()

        // Keep the denormalised label on employees in sync with a rename.
        if (data.label) {
            await Employee.updateMany(
                { "assignedLocation.office": office.key },
                { $set: { "assignedLocation.label": office.label } }
            )
        }
        return res.json({ data: office })
    } catch (err) {
        console.error("updateOffice error:", err)
        return res.status(500).json({ error: "Failed to update office" })
    }
}

export const deleteOffice = async (req, res) => {
    try {
        const office = await Office.findById(req.params.id)
        if (!office) return res.status(404).json({ error: "Office not found" })

        const assigned = await Employee.countDocuments({ "assignedLocation.office": office.key, isDeleted: { $ne: true } })
        if (assigned > 0)
            return res.status(409).json({
                error: `${assigned} employee${assigned > 1 ? "s are" : " is"} assigned to this office. Reassign them before deleting.`,
            })

        await office.deleteOne()
        return res.json({ message: "Office deleted" })
    } catch (err) {
        console.error("deleteOffice error:", err)
        return res.status(500).json({ error: "Failed to delete office" })
    }
}