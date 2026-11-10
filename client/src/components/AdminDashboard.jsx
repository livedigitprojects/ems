
import {
  Building2Icon, CalendarIcon, FileTextIcon, UsersIcon,
  ClockIcon, LogInIcon, LogOutIcon, Loader2Icon,
  IndianRupeeIcon, BellIcon, CalendarDaysIcon,
  ArrowRightIcon, ClipboardListIcon, MailIcon, DownloadIcon,
  UserXIcon,
} from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import api from "../api/axios"
import ExportReportModal from "./ExportReportModal"


const fmt = (iso) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
}

const StatusBadge = ({ status }) => {
  const map = {
    PRESENT: "bg-green-500/15 text-green-400",
    LATE:    "bg-yellow-500/15 text-yellow-400",
    ABSENT:  "bg-rose-500/15 text-rose-400",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-slate-700 text-slate-400"}`}>
      {status}
    </span>
  )
}

const Avatar = ({ firstName, lastName }) => (
  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
    <span className="text-xs font-bold text-indigo-400">{firstName?.[0]}{lastName?.[0]}</span>
  </div>
)

const StatCard = ({ icon: Icon, value, label, description, onClick }) => (
  <div
    onClick={onClick}
    className={`card card-hover p-4 sm:p-5 relative overflow-hidden group flex items-center justify-between ${onClick ? "cursor-pointer" : ""}`}
  >
    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-slate-500/70 group-hover:bg-indigo-500/70" />
    <div className="min-w-0">
      <p className="text-xs sm:text-sm text-slate-400 leading-tight">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-slate-100 mt-0.5">{value ?? 0}</p>
      <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    <Icon className="size-8 sm:size-10 p-1.5 sm:p-2.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0 ml-2" />
  </div>
)

const QuickNavCard = ({ icon: Icon, label, description, accent, onClick }) => (
  <div
    onClick={onClick}
    className="card card-hover p-4 sm:p-5 cursor-pointer group flex items-center gap-3 sm:gap-4"
  >
    <div className={`p-2.5 rounded-xl ${accent.bg} shrink-0 group-hover:scale-110 transition-transform`}>
      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${accent.icon}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5 truncate hidden sm:block">{description}</p>
    </div>
    <ArrowRightIcon className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
  </div>
)

// ─── Today's Attendance Table ─────────────────────────────────────────────────
const AttendanceTable = ({ records }) => (
  <div className="hidden sm:block overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-800">
          {["Employee", "Department", "Status", "Clock In", "Clock Out", "Hours"].map((h, i) => (
            <th key={h} className={`text-left py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? "px-5" : "px-4"}`}>
              {h === "Clock In"
                ? <span className="flex items-center gap-1"><LogInIcon  className="w-3.5 h-3.5 text-green-400" />{h}</span>
                : h === "Clock Out"
                  ? <span className="flex items-center gap-1"><LogOutIcon className="w-3.5 h-3.5 text-rose-400"  />{h}</span>
                  : h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60">
        {records.map((r) => (
          <tr key={r._id} className="hover:bg-slate-800/30 transition-colors">
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Avatar firstName={r.employee?.firstName} lastName={r.employee?.lastName} />
                <div>
                  <p className="text-sm font-medium text-slate-200">{r.employee?.firstName} {r.employee?.lastName}</p>
                  <p className="text-xs text-slate-500">{r.employee?.position}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{r.employee?.department ?? "—"}</span>
            </td>
            <td className="px-4 py-3.5"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3.5"><span className="text-green-400 font-medium font-mono text-xs">{fmt(r.checkIn)}</span></td>
            <td className="px-4 py-3.5">
              {r.checkOut
                ? <span className="text-rose-400 font-medium font-mono text-xs">{fmt(r.checkOut)}</span>
                : <span className="inline-flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />In office</span>}
            </td>
            <td className="px-4 py-3.5">
              {r.workingHours != null
                ? <span className="text-slate-300 text-xs font-medium">{r.workingHours.toFixed(1)}h{r.dayType && <span className="ml-1.5 text-slate-500">· {r.dayType}</span>}</span>
                : <span className="text-slate-600 text-xs">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const AttendanceCards = ({ records }) => (
  <div className="sm:hidden divide-y divide-slate-800/60">
    {records.map((r) => (
      <div key={r._id} className="px-4 py-3.5 flex items-start gap-3">
        <Avatar firstName={r.employee?.firstName} lastName={r.employee?.lastName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-slate-200 truncate">{r.employee?.firstName} {r.employee?.lastName}</p>
            <StatusBadge status={r.status} />
          </div>
          <p className="text-xs text-slate-500 mb-2">{r.employee?.position} · {r.employee?.department ?? "—"}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-green-400"><LogInIcon className="w-3 h-3" />{fmt(r.checkIn)}</span>
            {r.checkOut
              ? <span className="flex items-center gap-1 text-xs text-rose-400"><LogOutIcon className="w-3 h-3" />{fmt(r.checkOut)}</span>
              : <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />In office</span>}
            {r.workingHours != null && (
              <span className="text-xs text-slate-400">{r.workingHours.toFixed(1)}h{r.dayType && ` · ${r.dayType}`}</span>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
)

// ─── Absent Employees Table ───────────────────────────────────────────────────
const AbsentTable = ({ employees }) => (
  <div className="hidden sm:block overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-800">
          {["Employee", "Employee ID", "Department", "Designation", "Status"].map((h, i) => (
            <th key={h} className={`text-left py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? "px-5" : "px-4"}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60">
        {employees.map((e) => (
          <tr key={e._id} className="hover:bg-slate-800/30 transition-colors">
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-rose-400">{e.firstName?.[0]}{e.lastName?.[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{e.firstName} {e.lastName}</p>
                  <p className="text-xs text-slate-500">{e.position}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3.5">
              <span className="text-xs font-mono text-slate-400">{e.employeeId ?? "—"}</span>
            </td>
            <td className="px-4 py-3.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{e.department ?? "—"}</span>
            </td>
            <td className="px-4 py-3.5">
              <span className="text-xs text-slate-400">{e.position ?? "—"}</span>
            </td>
            <td className="px-4 py-3.5">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-500/15 text-rose-400">ABSENT</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const AbsentCards = ({ employees }) => (
  <div className="sm:hidden divide-y divide-slate-800/60">
    {employees.map((e) => (
      <div key={e._id} className="px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-rose-400">{e.firstName?.[0]}{e.lastName?.[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-200 truncate">{e.firstName} {e.lastName}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-500/15 text-rose-400 shrink-0">ABSENT</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{e.position} · {e.department ?? "—"}</p>
          {e.employeeId && <p className="text-xs text-slate-600 font-mono mt-0.5">{e.employeeId}</p>}
        </div>
      </div>
    ))}
  </div>
)

// ─── Main AdminDashboard ──────────────────────────────────────────────────────
const AdminDashboard = ({ data }) => {
  const navigate = useNavigate()
  const [activeTab,       setActiveTab]       = useState("today")
  const [todayAttendance, setTodayAttendance] = useState([])
  const [absentEmployees, setAbsentEmployees] = useState([])
  const [attLoading,      setAttLoading]      = useState(true)
  const [absentLoading,   setAbsentLoading]   = useState(false)
  const [absentFetched,   setAbsentFetched]   = useState(false)
  const [holidayName,     setHolidayName]     = useState(null)
  const [exportOpen,      setExportOpen]      = useState(false)

  useEffect(() => {
    api.get("/attendance/today")
      .then((res) => setTodayAttendance(res.data.data || []))
      .catch(() => setTodayAttendance([]))
      .finally(() => setAttLoading(false))
  }, [])

  const fetchAbsent = useCallback(async () => {
    if (absentFetched) return
    setAbsentLoading(true)
    try {
      const res = await api.get("/attendance/absent")
      setAbsentEmployees(res.data.data || [])
      setHolidayName(res.data.isHoliday ? res.data.holidayName : null)
      setAbsentFetched(true)
    } catch {
      setAbsentEmployees([])
    } finally {
      setAbsentLoading(false)
    }
  }, [absentFetched])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === "absent") fetchAbsent()
  }

  const stillIn    = todayAttendance.filter((r) => !r.checkOut)
  const checkedOut = todayAttendance.filter((r) =>  r.checkOut)

  const quickNav = [
    { icon: UsersIcon,         label: "Employees",                 description: "Manage all employee profiles",                   accent: { bg: "bg-indigo-500/10", icon: "text-indigo-400" }, onClick: () => navigate("/employees")      },
    { icon: FileTextIcon,      label: "Leave Requests",            description: "Review and approve leave applications",          accent: { bg: "bg-rose-500/10",   icon: "text-rose-400"   }, onClick: () => navigate("/leave")          },
    { icon: IndianRupeeIcon,   label: "Payslips",                  description: "Generate and manage monthly payslips",           accent: { bg: "bg-green-500/10",  icon: "text-green-400"  }, onClick: () => navigate("/payslips")       },
    { icon: CalendarDaysIcon,  label: "Calendar",                  description: "Holidays and company events",                    accent: { bg: "bg-cyan-500/10",   icon: "text-cyan-400"   }, onClick: () => navigate("/calendar")       },
    { icon: BellIcon,          label: "Announcements",             description: "Post and manage announcements",                  accent: { bg: "bg-amber-500/10",  icon: "text-amber-400"  }, onClick: () => navigate("/announcements")  },
    { icon: ClipboardListIcon, label: "Attendance Regularization", description: "Review attendance correction requests",          accent: { bg: "bg-orange-500/10", icon: "text-orange-400" }, onClick: () => navigate("/regularization") },
    { icon: MailIcon,          label: "Letters",                   description: "Send offer, warning and appreciation letters",   accent: { bg: "bg-pink-500/10",   icon: "text-pink-400"   }, onClick: () => navigate("/letters")        },
  ]

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="page-header flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, Admin — here's your overview</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs sm:text-sm font-medium hover:bg-cyan-500/20 transition-colors"
          >
            <DownloadIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export Report</span>
          </button>
        </div>
      </div>

      {exportOpen && <ExportReportModal onClose={() => setExportOpen(false)} />}

      {/* Late Attendance Policy Banner */}
      <div className="mb-5 flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <ClockIcon className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-300">Late Attendance Policy</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Every{" "}
            <strong className="text-amber-300">3 late check-ins</strong>{" "}
            in a month results in{" "}
            <strong className="text-amber-300">1 day salary deduction</strong>{" "}
            (Loss of Pay). This is automatically applied when generating payslips.
          </p>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="mb-5 sm:mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-0.5">
          Quick Navigation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {quickNav.map((n) => <QuickNavCard key={n.label} {...n} />)}
        </div>
      </div>

      {/* Attendance Section with Tabs */}
      <div className="card overflow-hidden">

        {/* Card Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0">
              <ClockIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100">Attendance</h2>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 sm:hidden">
                {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </p>
            </div>
          </div>
          {/* Badges — change based on active tab */}
          {activeTab === "today" ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 font-medium whitespace-nowrap">
                {stillIn.length} <span className="hidden sm:inline">in office</span>
              </span>
              <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full bg-slate-700 text-slate-400 font-medium whitespace-nowrap">
                {checkedOut.length} <span className="hidden sm:inline">checked out</span>
              </span>
            </div>
          ) : (
            <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 font-medium whitespace-nowrap">
              {absentEmployees.length} <span className="hidden sm:inline">absent</span>
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => handleTabChange("today")}
            className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
              activeTab === "today"
                ? "text-indigo-400 border-indigo-500 bg-indigo-500/5"
                : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30"
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5" />
            Today's Attendance
            {!attLoading && todayAttendance.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "today" ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-400"
              }`}>
                {todayAttendance.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange("absent")}
            className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
              activeTab === "absent"
                ? "text-rose-400 border-rose-500 bg-rose-500/5"
                : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30"
            }`}
          >
            <UserXIcon className="w-3.5 h-3.5" />
            Absent Today
            {absentFetched && absentEmployees.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "absent" ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-400"
              }`}>
                {absentEmployees.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content — Today's Attendance */}
        {activeTab === "today" && (
          attLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2Icon className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading attendance…</span>
            </div>
          ) : todayAttendance.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No employees have clocked in today</p>
            </div>
          ) : (
            <>
              <AttendanceTable records={todayAttendance} />
              <AttendanceCards records={todayAttendance} />
            </>
          )
        )}

        {/* Tab Content — Absent Today */}
        {activeTab === "absent" && (
          absentLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2Icon className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading absent employees…</span>
            </div>
          ) : absentEmployees.length === 0 ? (
            <div className="text-center py-12">
              <UserXIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">
                {holidayName ? `Today is a company holiday (${holidayName}) - no one is marked absent`
                  : absentFetched ? "All employees have clocked in today 🎉" : "Click to load absent employees"}
              </p>
            </div>
          ) : (
            <>
              <AbsentTable    employees={absentEmployees} />
              <AbsentCards    employees={absentEmployees} />
            </>
          )
        )}
      </div>
    </div>
  )
}

export default AdminDashboard