import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import {
  ClockIcon, MapPinIcon, CalendarDaysIcon, PlusIcon, PencilIcon, TrashIcon,
  XIcon, CheckIcon, Loader2Icon, LocateFixedIcon, ChevronRightIcon,
} from "lucide-react"
import toast from "react-hot-toast"
import api from "../api/axios"
import { useAuth } from "../context/authContext"
import Loading from "../components/Loading"

const inputCls =
  "w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm " +
  "focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"

const fmtTime = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

const lateAfter = (hhmm, grace) => {
  const [h, m] = hhmm.split(":").map(Number)
  const total = h * 60 + m + Number(grace || 0)
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return fmtTime(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`)
}

const Card = ({ icon: Icon, title, subtitle, action, children }) => (
  <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-100 text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
)

// ─── Clock-in time + grace period ───────────────────────────────────────────────
const ClockInCard = () => {
  const [saved,   setSaved]   = useState(null)
  const [form,    setForm]    = useState({ clockInTime: "10:00", gracePeriodMinutes: 15 })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    api.get("/attendance-settings")
      .then(({ data }) => { setSaved(data.data); setForm(data.data) })
      .catch(() => toast.error("Could not load clock-in settings"))
      .finally(() => setLoading(false))
  }, [])

  const graceNum = Number(form.gracePeriodMinutes)
  const valid    = /^([01]\d|2[0-3]):[0-5]\d$/.test(form.clockInTime) &&
                   Number.isInteger(graceNum) && graceNum >= 0 && graceNum <= 240
  const dirty    = saved && (saved.clockInTime !== form.clockInTime || saved.gracePeriodMinutes !== graceNum)

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put("/attendance-settings", {
        clockInTime: form.clockInTime, gracePeriodMinutes: graceNum,
      })
      setSaved(data.data); setForm(data.data)
      toast.success("Clock-in settings updated")
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to save settings")
    } finally { setSaving(false) }
  }

  return (
    <Card icon={ClockIcon} title="Clock-in Time & Grace Period"
          subtitle="Applies to every employee, from the next clock-in onward">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Loader2Icon className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Official clock-in time (IST)</label>
              <input type="time" value={form.clockInTime} className={inputCls}
                     onChange={(e) => setForm((f) => ({ ...f, clockInTime: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Grace period (minutes)</label>
              <input type="number" min="0" max="240" step="1" value={form.gracePeriodMinutes} className={inputCls}
                     onChange={(e) => setForm((f) => ({ ...f, gracePeriodMinutes: e.target.value }))} />
            </div>
          </div>

          {valid && (
            <p className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5">
              Clock in by <span className="text-green-400 font-medium">{lateAfter(form.clockInTime, graceNum)}</span> to
              be marked <span className="text-green-400 font-medium">Present</span>. Anything later is marked{" "}
              <span className="text-yellow-400 font-medium">Late</span>.
            </p>
          )}

          <div className="flex justify-end">
            <button onClick={save} disabled={!valid || !dirty || saving}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                valid && dirty && !saving ? "bg-cyan-500 text-slate-900 hover:bg-cyan-400"
                                          : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}>
              {saving ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Office add / edit modal ────────────────────────────────────────────────────
const OfficeForm = ({ initial, onSave, onClose, saving }) => {
  const [form, setForm] = useState({
    label:        initial?.label        ?? "",
    latitude:     initial?.latitude     ?? "",
    longitude:    initial?.longitude    ?? "",
    radiusMeters: initial?.radiusMeters ?? 150,
  })
  const [locating, setLocating] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const lat = Number(form.latitude), lng = Number(form.longitude), rad = Number(form.radiusMeters)
  const valid =
    form.label.trim() &&
    form.latitude !== "" && Number.isFinite(lat) && lat >= -90  && lat <= 90 &&
    form.longitude !== "" && Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
    Number.isFinite(rad) && rad >= 10 && rad <= 5000

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation is not supported by this browser")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        set("latitude",  Number(coords.latitude.toFixed(7)))
        set("longitude", Number(coords.longitude.toFixed(7)))
        setLocating(false)
      },
      () => { setLocating(false); toast.error("Could not get your location. Allow location access and try again.") },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100">{initial ? "Edit Office" : "Add Office"}</h3>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Office name</label>
            <input value={form.label} onChange={(e) => set("label", e.target.value)}
                   placeholder="e.g. Hyderabad Office" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Latitude</label>
              <input type="number" step="any" value={form.latitude} placeholder="17.4965897"
                     onChange={(e) => set("latitude", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Longitude</label>
              <input type="number" step="any" value={form.longitude} placeholder="78.3595829"
                     onChange={(e) => set("longitude", e.target.value)} className={inputCls} />
            </div>
          </div>

          <button type="button" onClick={useMyLocation} disabled={locating}
            className="w-full px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 flex items-center justify-center gap-2">
            {locating ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <LocateFixedIcon className="w-3.5 h-3.5" />}
            Use my current location
          </button>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Permitted radius (meters)</label>
            <input type="number" min="10" max="5000" step="1" value={form.radiusMeters}
                   onChange={(e) => set("radiusMeters", e.target.value)} className={inputCls} />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Employees must clock in within this distance (10-5000 m). GPS accuracy worse than this radius is also rejected.
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800">
            Cancel
          </button>
          <button onClick={() => valid && onSave({ ...form, latitude: lat, longitude: lng, radiusMeters: rad })}
            disabled={!valid || saving}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
              valid && !saving ? "bg-cyan-500 text-slate-900 hover:bg-cyan-400" : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}>
            {saving ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
            {initial ? "Save Changes" : "Add Office"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Offices ────────────────────────────────────────────────────────────────────
const OfficesCard = () => {
  const [offices,  setOffices]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)       // null | "add" | office object
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/offices")
      setOffices(data.data || [])
    } catch { toast.error("Could not load offices") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (modal === "add") await api.post("/offices", form)
      else                 await api.put(`/offices/${modal._id}`, form)
      toast.success(modal === "add" ? "Office added" : "Office updated")
      setModal(null)
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to save office")
    } finally { setSaving(false) }
  }

  const handleDelete = async (office) => {
    if (!window.confirm(`Delete "${office.label}"? This cannot be undone.`)) return
    setDeleting(office._id)
    try {
      await api.delete(`/offices/${office._id}`)
      toast.success("Office deleted")
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to delete office")
    } finally { setDeleting(null) }
  }

  return (
    <>
      <Card icon={MapPinIcon} title="Office Locations & Geofencing"
            subtitle="Employees assigned to an office can only clock in inside its radius"
            action={
              <button onClick={() => setModal("add")}
                className="px-3 py-2 rounded-xl bg-cyan-500 text-slate-900 text-xs font-medium hover:bg-cyan-400 flex items-center gap-1.5 shrink-0">
                <PlusIcon className="w-3.5 h-3.5" /> Add Office
              </button>
            }>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2Icon className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : offices.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No offices yet. Add one to enable geofencing.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {offices.map((o) => (
              <li key={o._id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{o.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {o.latitude}, {o.longitude} &middot; {o.radiusMeters} m radius
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setModal(o)} title="Edit"
                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(o)} disabled={deleting === o._id} title="Delete"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800">
                    {deleting === o._id ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <TrashIcon className="w-4 h-4" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modal && (
        <OfficeForm initial={modal === "add" ? null : modal} saving={saving}
                    onSave={handleSave} onClose={() => !saving && setModal(null)} />
      )}
    </>
  )
}

// ─── Holidays (managed on the Holiday Calendar page) ────────────────────────────
const HolidaysCard = () => {
  const [holidays, setHolidays] = useState(null)

  useEffect(() => {
    api.get("/holidays").then(({ data }) => setHolidays(data)).catch(() => setHolidays([]))
  }, [])

  const upcoming = useMemo(() => {
    if (!holidays) return []
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })   // YYYY-MM-DD
    return holidays.filter((h) => h.date.slice(0, 10) >= today).slice(0, 5)
  }, [holidays])

  return (
    <Card icon={CalendarDaysIcon} title="Holidays"
          subtitle="Holidays are never counted as absent days"
          action={
            <Link to="/calendar"
              className="px-3 py-2 rounded-xl border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-800 flex items-center gap-1 shrink-0">
              Manage Holidays <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
          }>
      {holidays === null ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
          <Loader2Icon className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming holidays. Add them from the Holiday Calendar.</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((h) => (
            <li key={h._id} className="flex items-center justify-between text-sm">
              <span className="text-slate-200">{h.name}</span>
              <span className="text-xs text-slate-500">
                {new Date(`${h.date.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
                  weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────
const AttendanceSettings = () => {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Attendance Rules</h1>
        <p className="text-sm text-slate-500 mt-1">Clock-in timing, office geofencing and holidays</p>
      </div>
      <ClockInCard />
      <OfficesCard />
      <HolidaysCard />
    </div>
  )
}

export default AttendanceSettings