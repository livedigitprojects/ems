import { useState, useEffect, useRef, useCallback } from "react"
import { BellIcon, CheckCheckIcon, XIcon, ClockIcon, FileTextIcon, MegaphoneIcon, IndianRupeeIcon, MailIcon } from "lucide-react"
import api from "../api/axios"
import useSummary from "../hooks/useSummary"

const TYPE_STYLES = {
    LEAVE_REQUEST:                { icon: FileTextIcon,   color: "text-blue-400",   bg: "bg-blue-500/10"   },
    LEAVE_APPROVED:               { icon: CheckCheckIcon, color: "text-green-400",  bg: "bg-green-500/10"  },
    LEAVE_REJECTED:               { icon: XIcon,          color: "text-red-400",    bg: "bg-red-500/10"    },
    REGULARIZATION_REQUEST:       { icon: ClockIcon,      color: "text-orange-400", bg: "bg-orange-500/10" },
    REGULARIZATION_APPROVED:      { icon: CheckCheckIcon, color: "text-green-400",  bg: "bg-green-500/10"  },
    REGULARIZATION_REJECTED:      { icon: XIcon,          color: "text-red-400",    bg: "bg-red-500/10"    },
    LATE_REGULARIZATION_REQUEST:  { icon: ClockIcon,      color: "text-amber-400",  bg: "bg-amber-500/10"  },
    LATE_REGULARIZATION_APPROVED: { icon: CheckCheckIcon, color: "text-teal-400",   bg: "bg-teal-500/10"   },
    LATE_REGULARIZATION_REJECTED: { icon: XIcon,          color: "text-red-400",    bg: "bg-red-500/10"    },
    ANNOUNCEMENT:                 { icon: MegaphoneIcon,  color: "text-purple-400", bg: "bg-purple-500/10" },
    PAYSLIP_GENERATED:            { icon: IndianRupeeIcon,color: "text-emerald-400",bg: "bg-emerald-500/10"},
    LETTER_RECEIVED:              { icon: MailIcon,       color: "text-sky-400",    bg: "bg-sky-500/10"    },
}

const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

const NotificationBell = () => {
    const [notifications, setNotifications] = useState([])
    const [open,          setOpen]          = useState(false)
    const [loading,       setLoading]       = useState(false)
    const panelRef = useRef(null)

    // Badge count comes from the shared summary poll (one request for the whole
    // app). The full list is only loaded when the panel is opened.
    const { summary, patchSummary } = useSummary(true)
    const unreadCount = summary.unreadNotifications

    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await api.get("/notifications")
            setNotifications(data.data || [])
            patchSummary({ unreadNotifications: data.unreadCount || 0 })
        } catch (err) {
            console.error("Failed to fetch notifications:", err?.response?.data || err.message)
        }
    }, [patchSummary])

    useEffect(() => {
        if (open) fetchNotifications()
    }, [open, fetchNotifications])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
        }
        if (open) document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [open])

    const markRead = async (id) => {
        try {
            await api.patch(`/notifications/${id}/read`)
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
            patchSummary({ unreadNotifications: Math.max(0, unreadCount - 1) })
        } catch (err) {
            console.error("Failed to mark notification read:", err?.response?.data || err.message)
        }
    }

    const markAllRead = async () => {
        setLoading(true)
        try {
            await api.patch("/notifications/read-all")
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            patchSummary({ unreadNotifications: 0 })
        } catch (err) {
            console.error("Failed to mark all notifications read:", err?.response?.data || err.message)
        }
        finally { setLoading(false) }
    }

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
                <BellIcon className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center px-1 animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[200] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <BellIcon className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-semibold text-slate-100">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} disabled={loading}
                                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-500">
                                <BellIcon className="w-8 h-8 opacity-30" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((n) => {
                                const style = TYPE_STYLES[n.type] || { icon: BellIcon, color: "text-slate-400", bg: "bg-slate-700/30" }
                                const Icon  = style.icon
                                return (
                                    <div key={n.id} onClick={() => !n.isRead && markRead(n.id)}
                                        className={`flex gap-3 px-4 py-3 border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/40 transition-colors
                                            ${!n.isRead ? "bg-indigo-500/5" : ""}`}>
                                        <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                            <Icon className={`w-4 h-4 ${style.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-semibold ${!n.isRead ? "text-slate-100" : "text-slate-300"}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                                            <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                                        </div>
                                        {!n.isRead && <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-2" />}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationBell