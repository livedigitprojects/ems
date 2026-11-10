import { useState, useEffect } from "react"
import {
  ClipboardListIcon, ChevronLeftIcon, ChevronRightIcon,
  ClockIcon, AlertCircleIcon, LoaderIcon, XIcon,
  CheckCircle2Icon, FileTextIcon,
} from "lucide-react"
import api from "../api/axios"
import toast from "react-hot-toast"
import ApplyLeaveModel from "../components/leave/ApplyLeaveModel"

// ─── Constants ────────────────────────────────────────────────────────────────
const REASON_OPTIONS = [
  { value: "FORGOT_TO_CHECKIN", label: "Forgot to check in"   },
  { value: "SYSTEM_ERROR",      label: "System / device error" },
  { value: "WORKED_FROM_HOME",  label: "Worked from home"      },
  { value: "CLIENT_VISIT",      label: "Client / field visit"  },
  { value: "OTHER",             label: "Other"                 },
]
const REASON_LABELS = {
  FORGOT_TO_CHECKIN: "Forgot to check in",
  SYSTEM_ERROR:      "System / device error",
  WORKED_FROM_HOME:  "Worked from home",
  CLIENT_VISIT:      "Client / field visit",
  OTHER:             "Other",
}
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]
const DAY_INDEX_MAP = {
  sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6,
}

const LEAVE_STYLES = {
  SICK:        { bg:"bg-sky-500/20",     border:"border-sky-500/40",     text:"text-sky-300",     dot:"bg-sky-400",     label:"Sick Leave"    },
  CASUAL:      { bg:"bg-purple-500/20",  border:"border-purple-500/40",  text:"text-purple-300",  dot:"bg-purple-400",  label:"Casual Leave"  },
  LOSS_OF_PAY: { bg:"bg-red-500/20",     border:"border-red-500/40",     text:"text-red-300",     dot:"bg-red-400",     label:"LOP (Absent)"  },
  PENDING:     { bg:"bg-orange-500/15",  border:"border-orange-500/35",  text:"text-orange-300",  dot:"bg-orange-400",  label:"Leave Pending" },
}

const DAY_STYLES = {
  PRESENT:       { bg:"bg-green-500/20",  border:"border-green-500/40",  text:"text-green-300",  dot:"bg-green-400",  label:"Present"       },
  LATE:          { bg:"bg-yellow-500/20", border:"border-yellow-500/40", text:"text-yellow-300", dot:"bg-yellow-400", label:"Late"          },
  LATE_APPROVED: { bg:"bg-teal-500/20",   border:"border-teal-500/40",   text:"text-teal-300",   dot:"bg-teal-400",   label:"Late Approved" },
  LATE_PENDING:  { bg:"bg-amber-500/15",  border:"border-amber-500/35",  text:"text-amber-300",  dot:"bg-amber-400",  label:"Late Pending"  },
  ABSENT:        { bg:"bg-red-500/20",    border:"border-red-500/40",    text:"text-red-300",    dot:"bg-red-400",    label:"Absent"        },
  PENDING:       { bg:"bg-orange-500/15", border:"border-orange-500/35", text:"text-orange-300", dot:"bg-orange-400", label:"Pending"       },
  APPROVED:      { bg:"bg-green-500/20",  border:"border-green-500/40",  text:"text-green-300",  dot:"bg-green-400",  label:"Approved"      },
  REJECTED:      { bg:"bg-red-500/15",    border:"border-red-500/30",    text:"text-red-400",    dot:"bg-red-400",    label:"Rejected"      },
  WEEKEND:       { bg:"bg-slate-800/60",  border:"border-slate-700/30",  text:"text-slate-600",  dot:null,            label:"Weekend"       },
  HOLIDAY:       { bg: "bg-cyan-500/15",   border: "border-cyan-500/35",   text: "text-cyan-300",   dot: "bg-cyan-400",   label: "Holiday"       },
  FUTURE:        { bg:"bg-slate-800/30",  border:"border-slate-700/20",  text:"text-slate-700",  dot:null,            label:""              },
}
const STATUS_PILL = {
  PENDING:  "bg-orange-500/15 text-orange-400 border-orange-500/20",
  APPROVED: "bg-green-500/15  text-green-400  border-green-500/20",
  REJECTED: "bg-red-500/15    text-red-400    border-red-500/20",
}

// ─── Absent Action Choice Modal ───────────────────────────────────────────────
const AbsentActionModal = ({ dateStr, onClose, onRegularize, onLeave }) => {
  const displayDate = new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  })
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-slate-100 font-semibold text-sm">Absent Day</h3>
            <p className="text-xs text-slate-400 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-400 mb-2">What would you like to do?</p>
          <button onClick={onRegularize}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
              <ClockIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-300">Apply for Regularization</p>
              <p className="text-xs text-slate-500 mt-0.5">WFH, client visit, forgot to check in…</p>
            </div>
          </button>
          <button onClick={onLeave}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
              <FileTextIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-300">Apply for Leave</p>
              <p className="text-xs text-slate-500 mt-0.5">Sick, casual, earned, or LOP leave</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Future Day Action Modal ──────────────────────────────────────────────────
const FutureActionModal = ({ dateStr, onClose, onLeave }) => {
  const displayDate = new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  })
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-slate-100 font-semibold text-sm">Upcoming Day</h3>
            <p className="text-xs text-slate-400 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <button onClick={onLeave}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
              <FileTextIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-300">Apply for Leave</p>
              <p className="text-xs text-slate-500 mt-0.5">Apply sick, casual, earned, or LOP leave in advance</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Absent Regularization Modal ──────────────────────────────────────────────
const RegularizationModal = ({ dateStr, onClose, onSubmitted }) => {
  const [reason,  setReason]  = useState("")
  const [remarks, setRemarks] = useState("")
  const [loading, setLoading] = useState(false)

  const displayDate = new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  })
  const submit = async () => {
    if (!reason) { toast.error("Please select a reason"); return }
    setLoading(true)
    try {
      await api.post("/regularization", { date: dateStr, reason, remarks })
      toast.success("Regularization request submitted!")
      onSubmitted(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit")
    } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-slate-100 font-semibold text-sm">Apply Attendance Regularization</h3>
            <p className="text-xs text-slate-400 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><XIcon className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Reason <span className="text-red-400">*</span></label>
            <div className="flex flex-col gap-2">
              {REASON_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => setReason(o.value)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-2 ${
                    reason === o.value
                      ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}>
                  {reason === o.value && <CheckCircle2Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Additional remarks <span className="text-slate-600">(optional)</span></label>
            <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="Provide any supporting details…"
              className="w-full text-sm bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <AlertCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-400" />
            Once approved, the day will be marked as Present.
          </p>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={loading || !reason} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {loading && <LoaderIcon className="w-3.5 h-3.5 animate-spin" />} Submit Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Late Regularization Modal ────────────────────────────────────────────────
const LateRegularizationModal = ({ dateStr, onClose, onSubmitted }) => {
  const [reason,  setReason]  = useState("")
  const [remarks, setRemarks] = useState("")
  const [loading, setLoading] = useState(false)

  const displayDate = new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  })
  const submit = async () => {
    if (!reason.trim()) { toast.error("Please provide a reason"); return }
    setLoading(true)
    try {
      await api.post("/regularization/late", { date: dateStr, reason, remarks })
      toast.success("Late regularization request submitted!")
      onSubmitted(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit")
    } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-slate-100 font-semibold text-sm">Late Regularization Request</h3>
            <p className="text-xs text-slate-400 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><XIcon className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300">
              You were marked <strong>Late</strong> on this day. If approved, it counts as <strong>Present</strong> for salary calculations.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Reason <span className="text-red-400">*</span></label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you arrived late…"
              className="w-full text-sm bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Additional remarks <span className="text-slate-600">(optional)</span></label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any supporting information…"
              className="w-full text-sm bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={loading || !reason.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading && <LoaderIcon className="w-3.5 h-3.5 animate-spin" />} Submit Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────
const CalendarGrid = ({ year, month, data, loading, onAbsentClick, onLateClick, onFutureClick }) => {
  const firstDay    = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const istNow      = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const todayStr    = istNow.toISOString().slice(0, 10)

  const rawWeekOff = data?.weekOff ?? []
  const offIndices = rawWeekOff.length
    ? new Set(rawWeekOff.map(d => DAY_INDEX_MAP[d?.toLowerCase()]).filter(n => n !== undefined))
    : new Set([0])

  const cells = []
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

    let status = "FUTURE", leaveStyle = null, leaveLabel = null

    if (isWeekend) {
      status = "WEEKEND"
    } else if (attRec?.status === "PRESENT") {
      status = "PRESENT"
    } else if (regRec?.status === "APPROVED") {
      status = "PRESENT"   // approved reg = treated as present
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
    } else if (regRec?.status === "REJECTED") {
      status = "REJECTED"
    } else {
      status = "ABSENT"
    }

    cells.push({ d, dateStr, status, attRec, regRec, lateReg, leaveInfo, leaveStyle, leaveLabel, holidayName, isWeekend, isFuture })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
      <LoaderIcon className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
    </div>
  )

  return (
    <>
      <div className="grid grid-cols-7 mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-slate-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`blank-${idx}`} />
          const s         = cell.status === "LEAVE" ? (cell.leaveStyle || LEAVE_STYLES.SICK) : (DAY_STYLES[cell.status] || DAY_STYLES.FUTURE)
          const canAbsent = cell.status === "ABSENT"
          const canLate   = cell.status === "LATE"
          const canFuture = cell.isFuture && cell.status === "FUTURE"
          const isPending = cell.status === "PENDING" || cell.status === "LATE_PENDING"
          const isRejected= cell.status === "REJECTED"
          const isClickable = canAbsent || canLate || canFuture
          return (
            <div key={cell.dateStr}
              onClick={() => {
                if (canAbsent)      onAbsentClick(cell.dateStr)
                else if (canLate)   onLateClick(cell.dateStr)
                else if (canFuture) onFutureClick(cell.dateStr)
              }}
              title={
                cell.status === "LEAVE" ? `${cell.leaveLabel} (${cell.leaveInfo?.status})`
                : cell.lateReg ? `Late Reg: ${cell.lateReg.status}${cell.lateReg.adminRemark ? " — " + cell.lateReg.adminRemark : ""}`
                : cell.regRec  ? `${cell.regRec.status}${cell.regRec.adminRemark ? " — " + cell.regRec.adminRemark : ""}`
                : cell.attRec  ? cell.attRec.status
                : cell.holidayName ? `Holiday: ${cell.holidayName}`
                : cell.isWeekend ? "Weekend"
                : cell.isFuture  ? "Click to apply leave"
                : "Absent"
              }
              className={`relative aspect-square flex flex-col items-center justify-center rounded-lg border text-xs font-medium
                ${s.bg} ${s.border} ${s.text}
                ${isClickable ? "cursor-pointer hover:brightness-125 transition-all" : ""}`}
            >
              <span>{cell.d}</span>
              {s.dot      && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${s.dot}`} />}
              {isPending   && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />}
              {isRejected  && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />}
              {canAbsent && (
                <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg bg-indigo-600/30">
                  <ClockIcon className="w-3 h-3 text-indigo-300" />
                </span>
              )}
              {canLate && (
                <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg bg-amber-600/30">
                  <ClockIcon className="w-3 h-3 text-amber-300" />
                </span>
              )}
              {canFuture && (
                <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg bg-blue-600/20">
                  <FileTextIcon className="w-3 h-3 text-blue-300" />
                </span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const EmployeeRegularization = () => {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const [year,       setYear]       = useState(istNow.getUTCFullYear())
  const [month,      setMonth]      = useState(istNow.getUTCMonth() + 1)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [leaveBalance, setLeaveBalance] = useState(null)
  const [activeTab,  setActiveTab]  = useState("absent")

  // Modal state — mirrors AttendanceCalendarModal exactly
  const [absentActionDate, setAbsentActionDate] = useState(null) // choice modal
  const [futureActionDate, setFutureActionDate] = useState(null) // future choice modal
  const [regDate,          setRegDate]          = useState(null) // regularization form
  const [lateRegDate,      setLateRegDate]      = useState(null) // late reg form
  const [leaveDate,        setLeaveDate]        = useState(null) // leave default date
  const [leaveModalOpen,   setLeaveModalOpen]   = useState(false)

  const load = async (y, m) => {
    setLoading(true)
    try {
      const [calRes, leaveRes] = await Promise.all([
        api.get(`/regularization/month-map?year=${y}&month=${m}`),
        api.get("/leave"),
      ])
      setData(calRes.data.data)
      setLeaveBalance(leaveRes.data.leaveBalance)
    } catch {
      toast.error("Failed to load attendance calendar")
    } finally { setLoading(false) }
  }

  useEffect(() => { load(year, month) }, [year, month])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const limit = new Date(now); limit.setMonth(limit.getMonth() + 3)
    if (year > limit.getFullYear() || (year === limit.getFullYear() && month >= limit.getMonth() + 1)) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }
  const isAtMaxMonth = (() => {
    const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const limit = new Date(now); limit.setMonth(limit.getMonth() + 3)
    return year > limit.getFullYear() || (year === limit.getFullYear() && month >= limit.getMonth() + 1)
  })()

  // Request lists
  const absentRegs   = Object.values(data?.regularizations     || {})
  const lateRegs     = Object.values(data?.lateRegularizations || {})
  const pendingAbs   = absentRegs.filter(r => r.status === "PENDING").length
  const approvedAbs  = absentRegs.filter(r => r.status === "APPROVED").length
  const pendingLate  = lateRegs.filter(r => r.status === "PENDING").length
  const approvedLate = lateRegs.filter(r => r.status === "APPROVED").length
  const sortedAbsent = [...absentRegs].sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
  const sortedLate   = [...lateRegs].sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
  const activeReqs   = activeTab === "absent" ? sortedAbsent : sortedLate

  const legend = [
    { label:"Present",          dot:"bg-green-400"   },
    { label:"Late",             dot:"bg-yellow-400"  },
    { label:"Late (Approved)",  dot:"bg-teal-400"    },
    { label:"Absent",           dot:"bg-red-400"     },
    { label:"Pending",          dot:"bg-orange-400"  },
    { label:"Sick/CL/EL Leave", dot:"bg-sky-400"     },
    { label:"LOP (Absent)",     dot:"bg-red-400"     },
    { label:"Leave Pending",    dot:"bg-orange-400"  },
    { label:"Weekend",          dot:"bg-slate-600"   },
    { label: "Holiday",          dot: "bg-cyan-400"   },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <ClipboardListIcon className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="page-title">Attendance Regularization</h1>
            <p className="page-subtitle">Click a red (absent) or yellow (late) day to submit a request</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Summary chips */}
        {!loading && (absentRegs.length > 0 || lateRegs.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {pendingAbs   > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-orange-500/15 text-orange-400 border-orange-500/20"><span className="text-base font-bold leading-none">{pendingAbs}</span>Absent Pending</span>}
            {approvedAbs  > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-green-500/15  text-green-400  border-green-500/20"><span className="text-base font-bold leading-none">{approvedAbs}</span>Absent Approved</span>}
            {pendingLate  > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-amber-500/15  text-amber-400  border-amber-500/20"><span className="text-base font-bold leading-none">{pendingLate}</span>Late Pending</span>}
            {approvedLate > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-teal-500/15   text-teal-400   border-teal-500/20"><span className="text-base font-bold leading-none">{approvedLate}</span>Late Approved</span>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* Calendar — 3/5 */}
          <div className="lg:col-span-3 card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-semibold text-slate-100">{MONTH_NAMES[month - 1]} {year}</h2>
              <button onClick={nextMonth} disabled={isAtMaxMonth}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 sm:p-4">
              <CalendarGrid
                year={year} month={month} data={data} loading={loading}
                onAbsentClick={(d) => setAbsentActionDate(d)}
                onLateClick={(d) => setLateRegDate(d)}
                onFutureClick={(d) => setFutureActionDate(d)}
              />

              {!loading && (
                <>
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800">
                    {legend.map((l) => (
                      <span key={l.label} className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${l.dot}`} />{l.label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <AlertCircleIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      Click <span className="text-red-400 font-medium mx-0.5">red (absent)</span> to regularize or apply leave
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <AlertCircleIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Click a <span className="text-yellow-400 font-medium mx-0.5">yellow (late)</span> day to request late regularization
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <AlertCircleIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      Click a <span className="text-blue-400 font-medium mx-0.5">future</span> day to apply leave in advance
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Requests panel — 2/5 */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="flex border-b border-slate-800">
              <button onClick={() => setActiveTab("absent")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                  activeTab === "absent"
                    ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5"
                    : "text-slate-500 hover:text-slate-300"
                }`}>
                <ClipboardListIcon className="w-3.5 h-3.5" />
                Absent Requests
                {pendingAbs > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-bold">{pendingAbs}</span>}
              </button>
              <button onClick={() => setActiveTab("late")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                  activeTab === "late"
                    ? "text-amber-400 border-b-2 border-amber-500 bg-amber-500/5"
                    : "text-slate-500 hover:text-slate-300"
                }`}>
                <ClockIcon className="w-3.5 h-3.5" />
                Late Requests
                {pendingLate > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">{pendingLate}</span>}
              </button>
            </div>

            <div className="px-4 py-2 border-b border-slate-800">
              <p className="text-xs text-slate-500">{MONTH_NAMES[month - 1]} {year}</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <LoaderIcon className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : activeReqs.length === 0 ? (
              <div className="text-center py-10">
                <ClipboardListIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No {activeTab} requests this month</p>
                <p className="text-xs text-slate-600 mt-1">
                  {activeTab === "absent" ? "Click a red day to apply" : "Click a yellow late day to apply"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-[420px] overflow-y-auto">
                {activeReqs.map((req) => {
                  const dateLabel = req.date
                    ? new Date(req.date).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })
                    : "—"
                  return (
                    <div key={req._id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-slate-200">{dateLabel}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 border ${STATUS_PILL[req.status] || ""}`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {activeTab === "absent" ? (REASON_LABELS[req.reason] || req.reason) : req.reason}
                      </p>
                      {req.status === "APPROVED" && activeTab === "late" && (
                        <p className="text-[11px] text-teal-400 mt-1">✓ Counted as Present for salary</p>
                      )}
                      {req.remarks && (
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate">{req.remarks}</p>
                      )}
                      {req.adminRemark && (
                        <p className="text-[11px] text-indigo-400/70 mt-1">
                          <span className="text-slate-500">Admin: </span>{req.adminRemark}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {absentActionDate && (
        <AbsentActionModal
          dateStr={absentActionDate}
          onClose={() => setAbsentActionDate(null)}
          onRegularize={() => { setRegDate(absentActionDate); setAbsentActionDate(null) }}
          onLeave={() => { setLeaveDate(absentActionDate); setLeaveModalOpen(true); setAbsentActionDate(null) }}
        />
      )}
      {futureActionDate && (
        <FutureActionModal
          dateStr={futureActionDate}
          onClose={() => setFutureActionDate(null)}
          onLeave={() => { setLeaveDate(futureActionDate); setLeaveModalOpen(true); setFutureActionDate(null) }}
        />
      )}
      {regDate && (
        <RegularizationModal
          dateStr={regDate}
          onClose={() => setRegDate(null)}
          onSubmitted={() => load(year, month)}
        />
      )}
      {lateRegDate && (
        <LateRegularizationModal
          dateStr={lateRegDate}
          onClose={() => setLateRegDate(null)}
          onSubmitted={() => load(year, month)}
        />
      )}
      {leaveModalOpen && (
        <ApplyLeaveModel
          open={leaveModalOpen}
          onClose={() => { setLeaveModalOpen(false); setLeaveDate(null) }}
          onSuccess={() => load(year, month)}
          leaveBalance={leaveBalance}
          defaultDate={leaveDate}
        />
      )}
    </div>
  )
}

export default EmployeeRegularization