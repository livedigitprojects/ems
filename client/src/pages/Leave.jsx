import { useCallback, useEffect, useState } from "react"
import Loading from "../components/Loading"
import { PalmtreeIcon, PlusIcon, ThermometerIcon, UmbrellaIcon, StarIcon } from "lucide-react"
import LeaveHistory from "../components/leave/LeaveHistory"
import ApplyLeaveModel from "../components/leave/ApplyLeaveModel"
import { useAuth } from "../context/authContext"
import api from "../api/axios.js"
import toast from "react-hot-toast"

const Leave = () => {
    const { user } = useAuth()

    const [leaves,       setLeaves]       = useState([])
    const [leaveBalance, setLeaveBalance] = useState(null)
    const [loading,      setLoading]      = useState(true)
    const [showModel,    setShowModel]    = useState(false)
    const [isDeleted,    setIsDeleted]    = useState(false)

    const isAdmin = user?.role === "ADMIN"

    const fetchLeaves = useCallback(async () => {
        try {
            const res = await api.get("/leave")
            setLeaves(res.data.data || [])
            if (res.data.leaveBalance) setLeaveBalance(res.data.leaveBalance)
            if (res.data.employee?.isDeleted) setIsDeleted(true)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchLeaves() }, [fetchLeaves])

    if (loading) return <Loading />

    const approvedLeaves = leaves.filter((l) => l.status === "APPROVED")

    const leaveStats = [
        {
            label:     "Sick Leave",
            type:      "SICK",
            icon:      ThermometerIcon,
            used:      leaveBalance?.SICK?.used      ?? approvedLeaves.filter((l) => l.type === "SICK").length,
            remaining: leaveBalance?.SICK?.remaining ?? null,
            limit:     leaveBalance?.SICK?.limit     ?? 6,
            unlimited: false,
            badge:     { label: `${leaveBalance?.SICK?.limit ?? 4}/yr` },
            color:     "blue",
        },
        {
            label:     "Casual Leave",
            type:      "CASUAL",
            icon:      UmbrellaIcon,
            used:      leaveBalance?.CASUAL?.used      ?? approvedLeaves.filter((l) => l.type === "CASUAL").length,
            remaining: leaveBalance?.CASUAL?.remaining ?? null,
            limit:     leaveBalance?.CASUAL?.limit     ?? 6,
            unlimited: false,
            badge:     { label: `${leaveBalance?.CASUAL?.limit ?? 2}/yr` },
            color:     "indigo",
        },
        // {
        //     label:       "Earned Leave",
        //     type:        "EARNED",
        //     sub:         "company paid leaves",
        //     icon:        StarIcon,
        //     used:        leaveBalance?.EARNED?.used        ?? approvedLeaves.filter((l) => l.type === "EARNED").length,
        //     remaining:   leaveBalance?.EARNED?.remaining   ?? null,
        //     accumulated: leaveBalance?.EARNED?.accumulated ?? null,
        //     perMonth:    leaveBalance?.EARNED?.perMonth    ?? 2,
        //     unlimited:   false,
        //     earned:      true,
        //     badge:       { label: `${leaveBalance?.EARNED?.perMonth ?? 2}/mo` },
        //     color:       "green",
        // },
        {
            label:     "Loss of Pay",
            type:      "LOSS_OF_PAY",
            icon:      PalmtreeIcon,
            used:      leaveBalance?.LOSS_OF_PAY?.used ?? approvedLeaves.filter((l) => l.type === "LOSS_OF_PAY").length,
            remaining: null,
            limit:     null,
            unlimited: true,
            color:     "rose",
        },
    ]

    const colorMap = {
        blue:   { bar: "bg-blue-500",   text: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
        indigo: { bar: "bg-indigo-500", text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
        green:  { bar: "bg-green-500",  text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20"  },
        rose:   { bar: "bg-rose-500",   text: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20"   },
    }

    return (
        <div className="animate-fade-in lg:h-full lg:flex lg:flex-col lg:min-h-0">
            {/* Header */}
            <div className="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-slate-100 text-3xl">Leave Management</h1>
                    <p className="page-subtitle">
                        {isAdmin ? "Manage leave applications" : "Your leave history and requests"}
                    </p>
                </div>
                {!isAdmin && !isDeleted && (
                    <button
                        onClick={() => setShowModel(true)}
                        className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <PlusIcon className="w-4 h-4" /> Apply for Leave
                    </button>
                )}
            </div>

            {/* Leave Balance Cards — employee only */}
            {!isAdmin && (
                <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-6">
                    {leaveStats.map((s) => {
                        const c           = colorMap[s.color]
                        const pct         = s.limit ? Math.round((s.used / s.limit) * 100) : 0
                        const isExhausted = !s.unlimited && !s.earned && s.remaining === 0
                        const elExhausted = s.earned && s.remaining === 0 && s.accumulated > 0

                        return (
                            <div key={s.label} className="card p-5 relative overflow-hidden group">
                                {/* Left accent */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full ${c.bar} opacity-60 group-hover:opacity-100 transition-opacity`} />

                                {/* Icon + label + badge */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-lg ${c.bg}`}>
                                            <s.icon className={`w-4 h-4 ${c.text}`} />
                                        </div>
                                        <p className="text-sm font-medium text-slate-400">{s.label}</p>
                                    </div>

                                    {/* Status / limit badges */}
                                    {isExhausted ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-medium">
                                            Exhausted
                                        </span>
                                    ) : elExhausted ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-medium">
                                            Used all
                                        </span>
                                    ) : s.unlimited ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                                            Deducted
                                        </span>
                                    ) : s.badge ? (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text} font-medium`}>
                                            {s.badge.label}
                                        </span>
                                    ) : null}
                                </div>

                                {/* Numbers */}
                                <div className="mb-3">
                                    {s.unlimited ? (
                                        <>
                                            <p className="text-2xl font-bold text-slate-100">
                                                {s.used}
                                                <span className="text-sm font-normal text-slate-400 ml-1">days taken</span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">Unlimited — salary deducted per day</p>
                                        </>
                                    ) : s.earned ? (
                                        <>
                                            <span className="text-sm text-slate-500">{s.sub}</span>
                                            <p className="text-2xl font-bold text-slate-100">
                                                {s.remaining ?? 0}
                                                <span className="text-sm font-normal text-slate-400 ml-1">remaining</span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {s.used} used · {s.accumulated ?? 0} accumulated total
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-2xl font-bold text-slate-100">
                                                {s.remaining ?? (s.limit - s.used)}
                                                <span className="text-sm font-normal text-slate-400 ml-1">remaining</span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {s.used} of {s.limit} days used
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* Progress bar */}
                                {!s.unlimited && s.accumulated !== null && s.accumulated > 0 && (
                                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                isExhausted || elExhausted ? "bg-rose-500" : c.bar
                                            }`}
                                            style={{
                                                width: s.earned
                                                    ? `${Math.min(100, Math.round((s.used / s.accumulated) * 100))}%`
                                                    : `${pct}%`
                                            }}
                                        />
                                    </div>
                                )}
                                {!s.unlimited && !s.earned && s.limit && (
                                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isExhausted ? "bg-rose-500" : c.bar}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <LeaveHistory leaves={leaves} isAdmin={isAdmin} onUpdate={fetchLeaves} className="lg:flex-1 lg:min-h-0" />

            <ApplyLeaveModel
                open={showModel}
                onClose={() => setShowModel(false)}
                onSuccess={fetchLeaves}
                leaveBalance={leaveBalance}
            />
        </div>
    )
}

export default Leave