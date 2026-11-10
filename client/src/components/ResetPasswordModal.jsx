import { useState } from "react"
import { KeyIcon, XIcon, EyeIcon, EyeOffIcon, Loader2Icon, WandSparklesIcon, CopyIcon } from "lucide-react"
import toast from "react-hot-toast"
import api from "../api/axios"

const MIN_LENGTH = 6

// Random 12-char password that always contains upper, lower, digit and symbol.
const generatePassword = () => {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "@#$%&*!"]
  const all  = sets.join("")
  const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n
  const chars = sets.map((s) => s[rand(s.length)])
  while (chars.length < 12) chars.push(all[rand(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {           // Fisher-Yates shuffle
    const j = rand(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}

const inputCls =
  "w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm " +
  "focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"

/**
 * Admin-only modal to set a new password for an employee.
 * Props: employee (for the name), empId (Employee _id), onClose.
 */
const ResetPasswordModal = ({ employee, empId, onClose }) => {
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [show,     setShow]     = useState(false)
  const [saving,   setSaving]   = useState(false)

  const tooShort  = password.length > 0 && password.length < MIN_LENGTH
  const mismatch  = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !saving

  const handleGenerate = () => {
    const pw = generatePassword()
    setPassword(pw); setConfirm(pw); setShow(true)
  }

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(password); toast.success("Password copied") }
    catch { toast.error("Could not copy") }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await api.post(`/employees/${empId}/reset-password`, { newPassword: password })
      toast.success(`Password updated for ${employee.firstName}`)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={(e) => { e.stopPropagation(); if (!saving) onClose() }}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <KeyIcon className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm">Change Password</h3>
              <p className="text-xs text-slate-500 truncate">{employee.firstName} {employee.lastName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">New password</label>
            <div className="relative">
              <input type={show ? "text" : "password"} value={password} autoFocus autoComplete="new-password"
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder={`At least ${MIN_LENGTH} characters`} className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200">
                {show ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
            {tooShort && <p className="text-[11px] text-rose-400 mt-1.5">Must be at least {MIN_LENGTH} characters</p>}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Confirm password</label>
            <input type={show ? "text" : "password"} value={confirm} autoComplete="new-password"
                   onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter the password" className={inputCls} />
            {mismatch && <p className="text-[11px] text-rose-400 mt-1.5">Passwords do not match</p>}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={handleGenerate}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 flex items-center justify-center gap-2">
              <WandSparklesIcon className="w-3.5 h-3.5" /> Generate strong password
            </button>
            {password && (
              <button type="button" onClick={handleCopy}
                      className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 flex items-center gap-2">
                <CopyIcon className="w-3.5 h-3.5" /> Copy
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            Share the new password with the employee securely. It takes effect on their next sign-in.
          </p>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button type="button" onClick={onClose} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800">
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
                    canSubmit ? "bg-cyan-500 text-slate-900 hover:bg-cyan-400" : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}>
            {saving && <Loader2Icon className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  )
}

export default ResetPasswordModal