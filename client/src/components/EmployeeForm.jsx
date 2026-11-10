import { Loader2Icon, MapPinIcon, MapPinOffIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import api from "../api/axios"
import { DEPARTMENTS } from "../assets/assets.js"

// Offices are managed by admins (Attendance Rules page) and loaded from the API.

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Rh-Null"]

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section = ({ title, children }) => (
    <div className="card p-5 sm:p-6">
        <h3 className="text-base font-medium text-slate-900 mb-6 pb-4 border-b border-slate-100">{title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-slate-900">
            {children}
        </div>
    </div>
)

// ─── Main Form ────────────────────────────────────────────────────────────────

const EmployeeForm = ({ initialData, onSuccess, onCancel, isAdmin = false }) => {
    const navigate  = useNavigate()
    const [loading, setLoading] = useState(false)
    const isEditMode = !!initialData

    // Work schedule state
    const [workSchedule, setWorkSchedule] = useState({
        shiftStart: initialData?.workSchedule?.shiftStart ?? "",
        shiftEnd:   initialData?.workSchedule?.shiftEnd   ?? "",
        breakStart: initialData?.workSchedule?.breakStart ?? "",
        breakEnd:   initialData?.workSchedule?.breakEnd   ?? "",
        lunchStart: initialData?.workSchedule?.lunchStart ?? "",
        lunchEnd:   initialData?.workSchedule?.lunchEnd   ?? "",
        weekOff:    initialData?.workSchedule?.weekOff    ?? ["Saturday", "Sunday"],
    })

    const toggleWeekOff = (day) =>
        setWorkSchedule((prev) => ({
            ...prev,
            weekOff: prev.weekOff.includes(day)
                ? prev.weekOff.filter((d) => d !== day)
                : [...prev.weekOff, day],
        }))

    // Geofencing state — only track the office key, not raw coordinates
    const [enableGeofencing, setEnableGeofencing] = useState(
        !!initialData?.assignedLocation?.office
    )
    const [selectedOffice, setSelectedOffice] = useState(
        initialData?.assignedLocation?.office || ""
    )

    const [offices, setOffices] = useState([])
    useEffect(() => {
        if (!isAdmin) return
        api.get("/offices")
            .then(({ data }) => setOffices(data.data || []))
            .catch(() => toast.error("Could not load office locations"))
    }, [isAdmin])
    const selectedOfficeData = offices.find((o) => o.key === selectedOffice)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (isAdmin && enableGeofencing && !selectedOffice) {
            toast.error("Please select an office location or disable geofencing.")
            return
        }

        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const body     = Object.fromEntries(formData.entries())

        if (body.date) { body.joinDate = body.date; delete body.date }
        if (isEditMode && !body.password) delete body.password

        if (isAdmin) {
            body.workSchedule = workSchedule

            // Send only the office key — the backend resolves coordinates
            // from the Office collection. Never send raw lat/lng from the frontend.
            body.assignedLocation = enableGeofencing && selectedOffice
                ? { office: selectedOffice }
                : { office: null }
        }

        try {
            const url    = isEditMode ? `/employees/${initialData._id || initialData.id}` : "/employees"
            const method = isEditMode ? "put" : "post"
            await api[method](url, body)
            toast.success(isEditMode ? "Employee updated" : "Employee created")
            onSuccess ? onSuccess() : navigate("/employees")
        } catch (error) {
            toast.error(error.response?.data?.error || error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl animate-fade-in">

            {/* ── Personal Information ── */}
            <Section title="Personal Information">
                <div>
                    <label className="block mb-2">First Name</label>
                    <input name="firstName" required defaultValue={initialData?.firstName} />
                </div>
                <div>
                    <label className="block mb-2">Last Name</label>
                    <input name="lastName" required defaultValue={initialData?.lastName} />
                </div>
                <div>
                    <label className="block mb-2">Phone Number</label>
                    <input name="phone" required defaultValue={initialData?.phone} />
                </div>
                <div>
                    <label className="block mb-2">Join Date</label>
                    <input
                        type="date" name="date" required
                        defaultValue={
                            initialData?.joinDate
                                ? new Date(initialData.joinDate).toISOString().split("T")[0]
                                : ""
                        }
                    />
                </div>
                <div>
                    <label className="block mb-2">Date of Birth</label>
                    <input
                        type="date" name="dateOfBirth"
                        defaultValue={
                            initialData?.dateOfBirth
                                ? new Date(initialData.dateOfBirth).toISOString().split("T")[0]
                                : ""
                        }
                    />
                </div>
                <div>
                    <label className="block mb-2">Blood Group</label>
                    <select name="bloodGroup" defaultValue={initialData?.bloodGroup || ""}>
                        <option value="">Select Blood Group</option>
                        {BLOOD_GROUPS.map((bg) => (
                            <option key={bg} value={bg}>{bg}</option>
                        ))}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="block mb-2">Bio (Optional)</label>
                    <textarea
                        name="bio" rows={3} defaultValue={initialData?.bio}
                        className="resize-none" placeholder="Brief description..."
                    />
                </div>
            </Section>

            {/* ── Employee Details ── */}
            <Section title="Employee Details">
                <div>
                    <label className="block mb-2">Employee ID</label>
                    <input
                    name="employeeId"
                    placeholder="Auto-generated (e.g. Ld001)"
                    defaultValue={initialData?.employeeId || ""}
                />
                </div>
                <div>
                    <label className="block mb-2">Department</label>
                    <select name="department" defaultValue={initialData?.department || ""}>
                        <option value="">Select Department</option>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block mb-2">Position</label>
                    <input name="position" required defaultValue={initialData?.position} />
                </div>
                <div>
                    <label className="block mb-2">Salary</label>
                    <input type="number" name="basicSalary" required min="0" step="0.01" defaultValue={initialData?.basicSalary || 0} />
                </div>
                {isEditMode && (
                    <div>
                        <label className="block mb-2">Employment Status</label>
                        <select name="employmentStatus" defaultValue={initialData?.employmentStatus}>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>
                    </div>
                )}
            </Section>

            {/* ── Account Setup ── */}
            <div className="card p-5 sm:p-6">
                <h3 className="text-base font-medium text-slate-900 mb-6 pb-4 border-b border-slate-100">Account Setup</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-slate-900">
                    <div className="sm:col-span-2">
                        <label className="block mb-2">Work Email</label>
                        <input type="email" name="email" required defaultValue={initialData?.email} />
                    </div>
                    {!isEditMode && (
                        <div>
                            <label className="block mb-2">Temporary Password</label>
                            <input type="password" name="password" required />
                        </div>
                    )}
                    {isEditMode && (
                        <div>
                            <label className="block mb-2">Change Password (Optional)</label>
                            <input type="password" name="password" placeholder="Leave blank to keep current" />
                        </div>
                    )}
                    <div>
                        <label className="block mb-2">System Role</label>
                        <select name="role" defaultValue={initialData?.user?.role || "EMPLOYEE"}>
                            <option value="EMPLOYEE">Employee</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Bank Details — admin only ── */}
            {isAdmin && (
                <Section title="Bank Details">
                    <div className="sm:col-span-2">
                        <label className="block mb-2">Account Holder Name</label>
                        <input name="accountHolderName" placeholder="As per bank records" defaultValue={initialData?.bankDetails?.accountHolderName} />
                    </div>
                    <div>
                        <label className="block mb-2">Bank Name</label>
                        <input name="bankName" placeholder="e.g. State Bank of India" defaultValue={initialData?.bankDetails?.bankName} />
                    </div>
                    <div>
                        <label className="block mb-2">Account Type</label>
                        <select name="accountType" defaultValue={initialData?.bankDetails?.accountType || ""}>
                            <option value="">Select Type</option>
                            <option value="SAVINGS">Savings</option>
                            <option value="CURRENT">Current</option>
                        </select>
                    </div>
                    <div>
                        <label className="block mb-2">Account Number</label>
                        <input name="accountNumber" placeholder="Enter account number" defaultValue={initialData?.bankDetails?.accountNumber} />
                    </div>
                    <div>
                        <label className="block mb-2">IFSC Code</label>
                        <input name="ifscCode" placeholder="e.g. SBIN0001234" defaultValue={initialData?.bankDetails?.ifscCode} />
                    </div>
                </Section>
            )}

            {/* ── Work Schedule — admin only ── */}
            {isAdmin && (
                <div className="card p-5 sm:p-6">
                    <h3 className="text-base font-medium text-slate-900 mb-6 pb-4 border-b border-slate-100">Work Schedule</h3>
                    <div className="space-y-6 text-sm text-slate-900">

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Shift Timings</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-2">Shift Start</label>
                                    <input type="time" value={workSchedule.shiftStart}
                                        onChange={(e) => setWorkSchedule((p) => ({ ...p, shiftStart: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block mb-2">Shift End</label>
                                    <input type="time" value={workSchedule.shiftEnd}
                                        onChange={(e) => setWorkSchedule((p) => ({ ...p, shiftEnd: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Lunch Timings</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-2">Lunch Start</label>
                                    <input type="time" value={workSchedule.lunchStart}
                                        onChange={(e) => setWorkSchedule((p) => ({ ...p, lunchStart: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block mb-2">Lunch End</label>
                                    <input type="time" value={workSchedule.lunchEnd}
                                        onChange={(e) => setWorkSchedule((p) => ({ ...p, lunchEnd: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Break Timings</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-2">Break Start</label>
                                    <input type="time" value={workSchedule.breakStart}
                                        onChange={(e) => setWorkSchedule((p) => ({ ...p, breakStart: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block mb-2">Break End</label>
                                    <input type="time" value={workSchedule.breakEnd}
                                        onChange={(e) => setWorkSchedule((p) => ({ ...p, breakEnd: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Week Off Days</p>
                            <div className="flex flex-wrap gap-2">
                                {DAYS_OF_WEEK.map((day) => {
                                    const selected = workSchedule.weekOff.includes(day)
                                    return (
                                        <button
                                            key={day} type="button"
                                            onClick={() => toggleWeekOff(day)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                                selected
                                                    ? "bg-indigo-600 text-white border-indigo-600"
                                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                                            }`}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    )
                                })}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Selected: {workSchedule.weekOff.length > 0 ? workSchedule.weekOff.join(", ") : "None"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Attendance Location — admin only ── */}
            {isAdmin && (
                <div className="card p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                        <div>
                            <h3 className="text-base font-medium text-slate-900">Attendance Location</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Restrict employee clock-in to a specific office</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEnableGeofencing((v) => !v)
                                setSelectedOffice("")
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                                enableGeofencing ? "bg-indigo-600" : "bg-slate-200"
                            }`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                enableGeofencing ? "translate-x-5" : "translate-x-0"
                            }`} />
                        </button>
                    </div>

                    {enableGeofencing ? (
                        <div className="space-y-4 text-sm text-slate-900">
                            <div>
                                <label className="block mb-2">Select Office</label>
                                <select
                                    value={selectedOffice}
                                    onChange={(e) => setSelectedOffice(e.target.value)}
                                    required
                                >
                                    <option value="">Select Office Location</option>
                                    {offices.map((office) => (
                                        <option key={office.key} value={office.key}>{office.label}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedOfficeData && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-indigo-600 font-medium mb-2">
                                        <MapPinIcon className="w-4 h-4" />
                                        {selectedOfficeData.label}
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-1">
                                        <p>Latitude: {selectedOfficeData.latitude}</p>
                                        <p>Longitude: {selectedOfficeData.longitude}</p>
                                        <p>Allowed Radius: {selectedOfficeData.radiusMeters}m</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                            <MapPinOffIcon className="w-4 h-4" />
                            No restriction — employee cannot clock in until an office is assigned
                        </p>
                    )}
                </div>
            )}

            {/* ── Buttons ── */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => onCancel ? onCancel() : navigate(-1)}>
                    Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center">
                    {loading && <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />}
                    {isEditMode ? "Update Employee" : "Create Employee"}
                </button>
            </div>
        </form>
    )
}

export default EmployeeForm