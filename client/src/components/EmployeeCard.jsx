import { useState } from "react"
import api from "../api/axios"
import toast from "react-hot-toast"
import ResetPasswordModal from "./ResetPasswordModal"
import {
  PencilIcon, Trash2Icon, X, Loader2Icon, EyeIcon,
  ClockIcon, CoffeeIcon, UtensilsIcon, CalendarOffIcon, MapPinIcon, KeyIcon, RotateCcwIcon,
} from "lucide-react"

const fmt12 = (time24) => {
  if (!time24) return "—"
  const [h, m] = time24.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

const Avatar = ({ src, firstName, lastName, className = "", textClass = "" }) => {
  const [imgError, setImgError] = useState(false)
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`
  if (src && !imgError) {
    return (
      <img src={src} alt={`${firstName} ${lastName}`}
        className={`object-cover ${className}`}
        onError={() => setImgError(true)} />
    )
  }
  return <span className={`font-semibold ${textClass}`}>{initials}</span>
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const Row = ({ icon: Icon, text }) => (
  <span className="flex items-center gap-1"><Icon className="w-3 h-3" />{text}</span>
)

const Section = ({ title, children }) => (
  <div>
    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h4>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
)

const Detail = ({ label, value, highlight }) => (
  <div>
    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
    <p className={`text-sm font-medium break-words ${highlight ? "text-indigo-600" : "text-slate-800"}`}>
      {value || "—"}
    </p>
  </div>
)

const colorMap = {
  green:  "bg-green-50 text-green-700",
  yellow: "bg-yellow-50 text-yellow-700",
  red:    "bg-red-50 text-red-700",
  blue:   "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700",
}

const StatBox = ({ label, value, color }) => (
  <div className={`rounded-xl p-3 ${colorMap[color]}`}>
    <p className="text-2xl font-bold">{value ?? 0}</p>
    <p className="text-xs mt-0.5 opacity-80">{label}</p>
  </div>
)

// ─── Main EmployeeCard ────────────────────────────────────────────────────────
const EmployeeCard = ({ employee, onDelete, onEdit, onRestore, isAdmin = false }) => {
  const [showDetail,    setShowDetail]    = useState(false)
  const [detail,        setDetail]        = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError,   setDetailError]   = useState(null)
  const [showPwdModal,  setShowPwdModal]  = useState(false)
  const [restoring,     setRestoring]     = useState(false)

  const empId = employee.id || employee._id

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this employee?")) return
    try {
      await api.delete(`/employees/${empId}`)
      onDelete()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleRestore = async () => {
    if (!confirm("Restore this employee? Their account and dashboard access will be reactivated.")) return
    setRestoring(true)
    try {
      await api.post(`/employees/${empId}/restore`)
      toast.success("Employee restored")
      onRestore?.()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setRestoring(false)
    }
  }

  const handleViewDetail = async (e) => {
    e.stopPropagation()
    setDetailError(null)
    setDetail(null)
    setShowDetail(true)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/employees/${empId}`)
      setDetail(res.data)
    } catch (err) {
      setDetailError(err.response?.data?.error || "Failed to load employee details")
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <>
      {/* ── Card ── */}
      <div className="group relative card card-hover overflow-hidden">

        {/* Avatar area */}
        <div className="relative aspect-4/3 w-full overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          {employee.avatar ? (
            <Avatar src={employee.avatar} firstName={employee.firstName} lastName={employee.lastName}
              className="w-full h-full" textClass="text-2xl text-indigo-400" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 flex items-center justify-center">
              <span className="text-2xl font-medium text-indigo-400">
                {employee.firstName?.[0]}{employee.lastName?.[0]}
              </span>
            </div>
          )}
        </div>

        <div className="absolute top-3 left-3">
          <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-slate-600 rounded-lg shadow-sm">
            {employee.department || "Remote"}
          </span>
        </div>

        {/* Desktop hover actions */}
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-700/20 via-transparent to-transparent transition-opacity items-end justify-center pb-6 gap-3 hidden sm:flex opacity-0 group-hover:opacity-100">
          <button onClick={handleViewDetail}
            className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-700 hover:text-indigo-600 rounded-xl shadow-lg transition-all hover:scale-105"
            title="View Details">
            <EyeIcon className="w-4 h-4" />
          </button>
          {!employee.isDeleted && isAdmin && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onEdit(employee) }}
                className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-700 hover:text-indigo-600 rounded-xl shadow-lg transition-all hover:scale-105"
                title="Edit Employee">
                <PencilIcon className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowPwdModal(true) }}
                className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-700 hover:text-indigo-600 rounded-xl shadow-lg transition-all hover:scale-105"
                title="Change Password">
                <KeyIcon className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete() }}
                className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-700 hover:text-rose-600 rounded-xl shadow-lg transition-all hover:scale-105"
                title="Delete Employee">
                <Trash2Icon className="w-4 h-4" />
              </button>
            </>
          )}
          {employee.isDeleted && isAdmin && (
            <button onClick={(e) => { e.stopPropagation(); handleRestore() }}
              disabled={restoring}
              className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-700 hover:text-green-600 rounded-xl shadow-lg transition-all hover:scale-105 disabled:opacity-50"
              title="Restore Employee">
              {restoring ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <RotateCcwIcon className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Mobile actions */}
        <div className="absolute top-3 right-3 flex gap-2 sm:hidden">
          <button onClick={handleViewDetail}
            className="p-2 bg-white/90 text-indigo-600 rounded-xl shadow-lg">
            <EyeIcon className="w-4 h-4" />
          </button>
          {!employee.isDeleted && isAdmin && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onEdit(employee) }}
                className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                <PencilIcon className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowPwdModal(true) }}
                className="p-2 bg-slate-700 text-white rounded-xl shadow-lg">
                <KeyIcon className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete() }}
                className="p-2 bg-rose-500 text-white rounded-xl shadow-lg">
                <Trash2Icon className="w-4 h-4" />
              </button>
            </>
          )}
          {employee.isDeleted && isAdmin && (
            <button onClick={(e) => { e.stopPropagation(); handleRestore() }}
              disabled={restoring}
              className="p-2 bg-green-600 text-white rounded-xl shadow-lg disabled:opacity-50">
              {restoring ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <RotateCcwIcon className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-slate-100 truncate text-sm sm:text-base font-semibold">
              {employee.firstName} {employee.lastName}
            </h3>
            {employee.employeeId && (
              <span className="text-xs text-slate-500 font-mono shrink-0">{employee.employeeId}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{employee.position}</p>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/40 backdrop-blur-sm"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg my-6 sm:my-8 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">Employee Details</h2>
              <button onClick={() => setShowDetail(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail && (
              <div className="flex items-center justify-center py-16">
                <Loader2Icon className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            )}

            {!loadingDetail && detailError && (
              <div className="p-5 sm:p-6">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-rose-600">{detailError}</p>
                  <button onClick={handleViewDetail} className="mt-3 text-xs text-rose-500 underline">
                    Try again
                  </button>
                </div>
              </div>
            )}

            {!loadingDetail && !detailError && detail && (
              <div className="p-5 sm:p-6 space-y-5 sm:space-y-6">

                {/* Avatar + Basic Info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center shrink-0 ring-2 ring-indigo-100">
                    <Avatar src={detail.avatar} firstName={detail.firstName} lastName={detail.lastName}
                      className="w-full h-full rounded-full" textClass="text-xl text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                        {detail.firstName} {detail.lastName}
                      </h3>
                      {detail.employeeId && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {detail.employeeId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500">{detail.position} · {detail.department}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        detail.employmentStatus === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {detail.employmentStatus}
                      </span>
                      {detail.bloodGroup && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-100 text-rose-600">
                          🩸 {detail.bloodGroup}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Section title="Personal Information">
                  <Detail label="Email"     value={detail.email} />
                  <Detail label="Phone"     value={detail.phone} />
                  <Detail label="Join Date" value={new Date(detail.joinDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
                  <Detail label="Role"      value={detail.user?.role} />
                  {detail.bio && <div className="col-span-2"><Detail label="Bio" value={detail.bio} /></div>}
                </Section>

                {detail.workSchedule?.shiftStart && (
                  <Section title="Work Schedule">
                    <Detail label={<Row icon={ClockIcon} text="Shift" />}
                      value={`${fmt12(detail.workSchedule.shiftStart)} – ${fmt12(detail.workSchedule.shiftEnd)}`} />
                    {detail.workSchedule.breakStart && (
                      <Detail label={<Row icon={CoffeeIcon} text="Break" />}
                        value={`${fmt12(detail.workSchedule.breakStart)} – ${fmt12(detail.workSchedule.breakEnd)}`} />
                    )}
                    {detail.workSchedule.lunchStart && (
                      <Detail label={<Row icon={UtensilsIcon} text="Lunch" />}
                        value={`${fmt12(detail.workSchedule.lunchStart)} – ${fmt12(detail.workSchedule.lunchEnd)}`} />
                    )}
                    {detail.workSchedule.weekOff?.length > 0 && (
                      <div className="col-span-2">
                        <Detail label={<Row icon={CalendarOffIcon} text="Week Off" />}
                          value={detail.workSchedule.weekOff.join(", ")} />
                      </div>
                    )}
                  </Section>
                )}

                {detail.assignedLocation?.latitude && (
                  <Section title="Assigned Location">
                    <div className="col-span-2">
                      <Detail label={<Row icon={MapPinIcon} text="Office" />}
                        value={detail.assignedLocation.label || "Custom"} />
                    </div>
                  </Section>
                )}

                <Section title="Salary Details">
                  <Detail label="Salary" value={`₹${detail.basicSalary?.toLocaleString("en-IN")}`} />
                </Section>

                <Section title="Attendance Summary (This Month)">
                  <StatBox label="Present" value={detail.attendanceSummary?.PRESENT} color="green"  />
                  <StatBox label="Late"    value={detail.attendanceSummary?.LATE}    color="yellow" />
                  <StatBox label="Absent"  value={detail.attendanceSummary?.ABSENT}  color="red"    />
                </Section>

                <Section title="Leave Summary (This Month)">
                  <StatBox label="Sick"        value={detail.leaveSummary?.SICK}        color="blue"   />
                  <StatBox label="Casual"      value={detail.leaveSummary?.CASUAL}      color="purple" />
                  <StatBox label="Loss of Pay" value={detail.leaveSummary?.LOSS_OF_PAY} color="red"    />
                </Section>

                {detail.bankDetails?.accountNumber && (
                  <Section title="Bank Details">
                    <Detail label="Account Holder" value={detail.bankDetails.accountHolderName} />
                    <Detail label="Bank Name"       value={detail.bankDetails.bankName} />
                    <Detail label="Account Number"  value={detail.bankDetails.accountNumber} />
                    <Detail label="IFSC Code"       value={detail.bankDetails.ifscCode} />
                    <Detail label="Account Type"    value={detail.bankDetails.accountType} />
                  </Section>
                )}

                {/* ── Admin Actions ── */}
                {isAdmin && !employee.isDeleted && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">

                    {/* Edit + Delete */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowDetail(false); onEdit(employee) }}
                        className="btn-primary flex items-center gap-2 flex-1 justify-center text-sm"
                      >
                        <PencilIcon className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => { setShowDetail(false); handleDelete() }}
                        className="btn-secondary flex items-center gap-2 flex-1 justify-center text-sm text-rose-500 hover:text-rose-600"
                      >
                        <Trash2Icon className="w-4 h-4" /> Delete
                      </button>
                    </div>

                    {/* Change Password */}
                    <button
                      onClick={() => setShowPwdModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      <KeyIcon className="w-4 h-4" /> Change Password
                    </button>
                  </div>
                )}

                {/* ── Restore (deactivated employee) ── */}
                {isAdmin && employee.isDeleted && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                      <p className="text-xs text-rose-600">
                        This employee is deactivated. They can't log in, clock in, or apply for leave until restored.
                      </p>
                    </div>
                    <button
                      onClick={() => { setShowDetail(false); handleRestore() }}
                      disabled={restoring}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {restoring ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <RotateCcwIcon className="w-4 h-4" />}
                      Restore Employee
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {showPwdModal && (
        <ResetPasswordModal employee={employee} empId={empId} onClose={() => setShowPwdModal(false)} />
      )}
    </>
  )
}

export default EmployeeCard