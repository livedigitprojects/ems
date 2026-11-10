import { useState, useEffect, useCallback } from "react"
import {
  XIcon, ChevronLeftIcon, ChevronRightIcon, LoaderIcon,
  AlertCircleIcon, EyeIcon, RefreshCwIcon,
} from "lucide-react"
import api from "../../api/axios"
import toast from "react-hot-toast"
import usePolling from "../../hooks/usePolling"
import AdminEmployeeRequestsPanel from "./AdminEmployeeRequestsPanel"

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

// Polling interval so the admin's read-only view catches up with attendance
// changes. Pauses automatically while the tab is hidden.
const POLL_MS = 60000

const LEAVE_STYLES = {
  SICK:        { bg: "bg-sky-500/20",    border: "border-sky-500/40",    text: "text-sky-300",    dot: "bg-sky-400",    label: "Sick Leave"    },
  CASUAL:      { bg: "bg-purple-500/20", border: "border-purple-500/40", text: "text-purple-300", dot: "bg-purple-400", label: "Casual Leave"  },
  LOSS_OF_PAY: { bg: "bg-red-500/20",    border: "border-red-500/40",    text: "text-red-300",    dot: "bg-red-400",    label: "LOP (Absent)"  },
  PENDING:     { bg: "bg-orange-500/15", border: "border-orange-500/35", text: "text-orange-300", dot: "bg-orange-400", label: "Leave Pending" },
}

const DAY_STYLES = {
  PRESENT:       { bg: "bg-green-500/20",  border: "border-green-500/40",  text: "text-green-300",  dot: "bg-green-400",  label: "Present"       },
  LATE:          { bg: "bg-yellow-500/20", border: "border-yellow-500/40", text: "text-yellow-300", dot: "bg-yellow-400", label: "Late"          },
  LATE_APPROVED: { bg: "bg-teal-500/20",   border: "border-teal-500/40",   text: "text-teal-300",   dot: "bg-teal-400",   label: "Late Approved" },
  LATE_PENDING:  { bg: "bg-amber-500/15",  border: "border-amber-500/35",  text: "text-amber-300",  dot: "bg-amber-400",  label: "Late Pending"  },
  ABSENT:        { bg: "bg-red-500/20",    border: "border-red-500/40",    text: "text-red-300",    dot: "bg-red-400",    label: "Absent"        },
  PENDING:       { bg: "bg-orange-500/15", border: "border-orange-500/35", text: "text-orange-300", dot: "bg-orange-400", label: "Reg. Pending"  },
  APPROVED:      { bg: "bg-green-500/20",  border: "border-green-500/40",  text: "text-green-300",  dot: "bg-green-400",  label: "Reg. Approved" },
  WEEKEND:       { bg: "bg-slate-800/60",  border: "border-slate-700/30",  text: "text-slate-600",  dot: null,            label: "Weekend"       },
  HOLIDAY:       { bg: "bg-cyan-500/15",   border: "border-cyan-500/35",   text: "text-cyan-300",   dot: "bg-cyan-400",   label: "Holiday"       },
  FUTURE:        { bg: "bg-slate-800/30",  border: "border-slate-700/20",  text: "text-slate-700",  dot: null,            label: ""              },
}

// Same visual language (colors, legend, statuses) as the employee's own
// Attendancecalendarmodal — but strictly read-only: no click-through actions,
// no regularization/leave modals. Admins should see exactly what the employee
// sees, without being able to alter it from here.
const AdminAttendanceCalendarModal = ({ employeeId, employeeName, onClose }) => {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data,  setData]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (y, m, { silent } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      const res = await api.get(`/regularization/month-map/${employeeId}?year=${y}&month=${m}`)
      setData(res.data.data)
    } catch {
      if (!silent) toast.error("Failed to load attendance calendar")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employeeId])

  useEffect(() => { load(year, month) }, [year, month, load])

  // Keep the view fresh while the admin is looking at it. Pauses when the tab
  // is hidden and refreshes the moment they switch back.
  usePolling(() => load(year, month, { silent: true }), {
    intervalMs: POLL_MS,
    immediate:  false,
  })

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    const limit = new Date(); limit.setMonth(limit.getMonth() + 3)
    if (year > limit.getFullYear() || (year === limit.getFullYear() && month >= limit.getMonth() + 1)) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  const buildGrid = () => {
    const firstDay    = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const istNow      = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const todayStr    = istNow.toISOString().slice(0, 10)
    const cells       = []

    const DAY_INDEX_MAP = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    }
    const rawWeekOff = data?.weekOff ?? []
    const offIndices = rawWeekOff.length
      ? new Set(rawWeekOff.map(d => DAY_INDEX_MAP[d?.toLowerCase()]).filter(n => n !== undefined))
      : new Set([0])

    for (let i = 0; i < firstDay; i++) cells.push(null)

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr   = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      const dow       = new Date(year, month - 1, d).getDay()
      const isWeekend = offIndices.has(dow)
      const isFuture  = dateStr > todayStr
      const attRec    = data?.attendance?.[dateStr]
      const regRec    = data?.regularizations?.[dateStr]
      const lateReg   = data?.lateRegularizations?.[dateStr]
      const leaveInfo = data?.leaveDateMap?.[dateStr]
      const holidayName = data?.holidays?.[dateStr] || null

      let status = null, leaveStyle = null, leaveLabel = null

      if (isWeekend) {
        status = "WEEKEND"
      } else if (attRec?.status === "PRESENT") {
        status = "PRESENT"
      } else if (attRec?.status === "LATE") {
        if      (lateReg?.status === "APPROVED") status = "LATE_APPROVED"
        else if (lateReg?.status === "PENDING")  status = "LATE_PENDING"
        else                                     status = "LATE"
      } else if (holidayName) {
        status = "HOLIDAY"
      } else if (leaveInfo) {
        const ls = LEAVE_STYLES[leaveInfo.status === "PENDING" ? "PENDING" : leaveInfo.type]
        leaveStyle = ls; leaveLabel = ls?.label || "Leave"; status = "LEAVE"
      } else if (isFuture) {
        status = "FUTURE"
      } else if (regRec?.status === "PENDING") {
        status = "PENDING"
      } else if (regRec?.status === "APPROVED") {
        status = "APPROVED"
      } else {
        status = "ABSENT"
      }

      cells.push({ d, dateStr, status, attRec, regRec, lateReg, leaveInfo, leaveStyle, leaveLabel, holidayName, isWeekend, isFuture })
    }
    return cells
  }

  const cells = data ? buildGrid() : []

  const legend = [
    { label: "Present",          dot: "bg-green-400"  },
    { label: "Late",             dot: "bg-yellow-400" },
    { label: "Late (Approved)",  dot: "bg-teal-400"   },
    { label: "Absent",           dot: "bg-red-400"    },
    { label: "Sick/CL/EL Leave", dot: "bg-sky-400"    },
    { label: "LOP (Absent)",     dot: "bg-red-400"    },
    { label: "Leave Pending",    dot: "bg-orange-400" },
    { label: "Weekend",          dot: "bg-slate-600"  },
    { label: "Holiday",          dot: "bg-cyan-400"   },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <EyeIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <p className="text-xs font-medium text-indigo-300 truncate">{employeeName}</p>
              {refreshing && <RefreshCwIcon className="w-3 h-3 text-slate-500 animate-spin shrink-0" />}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <h2 className="text-slate-100 font-semibold min-w-[150px] text-center">
                {MONTH_NAMES[month - 1]} {year}
              </h2>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 shrink-0">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <LoaderIcon className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, idx) => {
                  if (!cell) return <div key={`blank-${idx}`} />
                  const s = cell.status === "LEAVE" ? (cell.leaveStyle || LEAVE_STYLES.SICK) : (DAY_STYLES[cell.status] || DAY_STYLES.FUTURE)

                  return (
                    <div key={cell.dateStr}
                      title={
                        cell.status === "LEAVE" ? `${cell.leaveLabel} (${cell.leaveInfo?.status})`
                        : cell.lateReg ? `Late Reg: ${cell.lateReg.status}`
                        : cell.regRec  ? `Reg: ${cell.regRec.status}`
                        : cell.attRec  ? cell.attRec.status
                        : cell.holidayName ? `Holiday: ${cell.holidayName}`
                        : cell.isWeekend ? "Weekend"
                        : cell.isFuture  ? "Upcoming"
                        : "Absent"
                      }
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl border text-xs font-medium ${s.bg} ${s.border} ${s.text}`}
                    >
                      <span>{cell.d}</span>
                      {s.dot && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${s.dot}`} />}
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800">
                {legend.map((l) => (
                  <span key={l.label} className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${l.dot}`} />{l.label}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
                <AlertCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
                Read-only view. Updates automatically as attendance changes.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl ml-6 p-2 w-100 max-h-[75vh] overflow-y-auto">
        <AdminEmployeeRequestsPanel
          employeeId={employeeId}
          onActioned={() => load(year, month, { silent: true })}
        />
      </div>
    </div>
  )
}

export default AdminAttendanceCalendarModal