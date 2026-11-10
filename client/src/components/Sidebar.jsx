import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
    CalendarIcon, ChevronRightIcon, FileTextIcon, IndianRupeeIcon,
    LayoutGridIcon, Loader2, LogOutIcon, MenuIcon, SettingsIcon,
    UserIcon, XIcon, UserCircleIcon, CalendarDaysIcon, BellIcon, ClipboardListIcon, MailIcon,
    CalendarClockIcon, SlidersHorizontalIcon,
} from "lucide-react"
import { useAuth } from "../context/authContext"
import api from "../api/axios"
import NotificationBell from "./NotificationBell"
import useSummary from "../hooks/useSummary"


const Sidebar = () => {
    const { pathname } = useLocation()
    const [profile,      setProfile]      = useState(null)
    const [imgError,     setImgError]     = useState(false)
    const [mobileOpen,   setMobileOpen]   = useState(false)
    const { user, loading, logout }       = useAuth()

    useEffect(() => {
        api.get("/profile")
            .then(({ data }) => { if (data?.firstName) setProfile(data) })
            .catch(() => {})
    }, [])

    useEffect(() => { setImgError(false) }, [profile?.avatar])
    useEffect(() => { setMobileOpen(false) }, [pathname])

    // ONE shared, visibility-aware poll for every badge (replaces 4 separate
    // 30s / 2min timers that kept hitting the API even in background tabs).
    const { summary, patchSummary } = useSummary(!!user)
    const unreadCount       = summary.unreadAnnouncements
    const pendingRegCount   = summary.pendingRegularizations
    const pendingLeaveCount = summary.pendingLeaves
    const unreadLetters     = summary.unreadLetters

    const role     = user?.role
    const userName = profile ? `${profile.firstName} ${profile.lastName || ""}`.trim() : ""

    const navItems = useMemo(() => [
        { name: "Dashboard",     href: "/dashboard",     icon: LayoutGridIcon  },
        ...(role === "ADMIN"
            ? [
                { name: "Employees",      href: "/employees",      icon: UserIcon,          },
                { name: "Regularization", href: "/regularization", icon: ClipboardListIcon, badge: pendingRegCount   },
                { name: "Attendance ", href: "/attendance-calendar", icon: CalendarClockIcon },
                { name: "Attendance Rules", href: "/attendance-settings", icon: SlidersHorizontalIcon },
              ]
            : [
                { name: "Attendance",       href: "/attendance",        icon: CalendarIcon      },
                { name: "Regularization",   href: "/my-regularization", icon: ClipboardListIcon },
                { name: "My Profile",       href: "/my-profile",        icon: UserCircleIcon    },
              ]
        ),
        { name: "Leave",         href: "/leave",         icon: FileTextIcon,    badge: role === "ADMIN" ? pendingLeaveCount : 0 },
        { name: "Payslips",      href: "/payslips",      icon: IndianRupeeIcon },
        { name: "Letters",       href: "/letters",       icon: MailIcon,        badge: role !== "ADMIN" ? unreadLetters : 0 },
        { name: "Holiday Calendar",      href: "/calendar",      icon: CalendarDaysIcon },
        { name: "Announcements", href: "/announcements", icon: BellIcon,        badge: unreadCount },
        { name: "Settings",      href: "/settings",      icon: SettingsIcon    },
    ], [role, unreadCount, pendingRegCount, pendingLeaveCount, unreadLetters])

    const handleLogout = () => { logout(); window.location.href = "/login" }

    // Mark a section as "seen". The cut-off is stored so the next poll only counts
    // requests that arrive AFTER this visit (the badge used to snap back to the full
    // pending total on every refresh).
    const markSeen = useCallback((href) => {
        const now = new Date().toISOString()
        if (href === "/announcements") {
            localStorage.setItem("announcementLastSeen", now)
            patchSummary({ unreadAnnouncements: 0 })
        }
        if (href === "/regularization") {
            localStorage.setItem("regularizationLastSeen", now)
            patchSummary({ pendingRegularizations: 0 })
        }
        if (href === "/leave") {
            localStorage.setItem("leaveLastSeen", now)
            patchSummary({ pendingLeaves: 0 })
        }
        if (href === "/letters") patchSummary({ unreadLetters: 0 })
    }, [patchSummary])

    const handleNavClick = (href) => markSeen(href)

    // Also covers arriving on the page by URL / back button, and new items that show up
    // while the admin is already looking at the page.
    useEffect(() => {
        if (role === "ADMIN") markSeen(pathname)
    }, [pathname, role, markSeen, summary.pendingRegularizations, summary.pendingLeaves])

    const avatarContent = profile?.avatar && !imgError ? (
        <img
            src={profile.avatar} alt={userName}
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px" }}
        />
    ) : (
        <span>{userName.charAt(0).toUpperCase()}</span>
    )

    const sidebarContent = (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
                @keyframes sb-fadeIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:none; } }
                @keyframes sb-blink  { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
                @keyframes sb-pulse  { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.5); opacity:0.6; } }
                @keyframes spin      { to { transform:rotate(360deg); } }

                .sb-wrap { display:flex; flex-direction:column; height:100%; background:#080b14; border-right:1px solid rgba(255,255,255,0.06); font-family:'DM Sans',sans-serif; position:relative; overflow:hidden; }
                .sb-orb  { position:absolute; border-radius:50%; pointer-events:none; filter:blur(60px); width:220px; height:220px; top:-60px; left:-60px; background:radial-gradient(circle,rgba(99,102,241,0.3),transparent 70%); }
                .sb-orb2 { position:absolute; border-radius:50%; pointer-events:none; filter:blur(50px); width:160px; height:160px; bottom:60px; right:-40px; background:radial-gradient(circle,rgba(6,182,212,0.2),transparent 70%); }

                .sb-brand { padding:24px 20px 20px; border-bottom:1px solid rgba(255,255,255,0.06); position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; }
                .sb-logo  { display:flex; align-items:center; gap:10px; }
                .sb-logo-icon { width:36px; height:36px; border-radius:10px; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); display:flex; align-items:center; justify-content:center; box-shadow:0 0 16px rgba(99,102,241,0.2); }
                .sb-logo-icon svg { width:17px; height:17px; stroke:#818cf8; }
                .sb-logo-name { font-family:'Syne',sans-serif; font-size:13px; font-weight:800; color:#fff; letter-spacing:-0.01em; line-height:1; }
                .sb-logo-sub  { font-size:10px; font-weight:300; color:rgba(255,255,255,0.25); letter-spacing:0.04em; margin-top:2px; }
                .sb-close { background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.3); padding:4px; border-radius:6px; transition:color 0.2s,background 0.2s; display:flex; align-items:center; justify-content:center; }
                .sb-close:hover { color:#fff; background:rgba(255,255,255,0.06); }

                .sb-user { margin:16px 12px 8px; padding:14px 16px; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); border-radius:14px; display:flex; align-items:center; gap:12px; position:relative; z-index:1; animation:sb-fadeIn 0.5s 0.1s cubic-bezier(0.16,1,0.3,1) both; }
                .sb-avatar { width:38px; height:38px; border-radius:10px; flex-shrink:0; background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.25); display:flex; align-items:center; justify-content:center; overflow:hidden; }
                .sb-avatar span { font-family:'Syne',sans-serif; font-size:14px; font-weight:800; background:linear-gradient(120deg,#818cf8,#38bdf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
                .sb-user-name { font-size:13px; font-weight:500; color:rgba(255,255,255,0.85); line-height:1; }
                .sb-user-role { font-size:11px; font-weight:300; color:rgba(255,255,255,0.3); margin-top:3px; }
                .sb-live { margin-left:auto; flex-shrink:0; width:7px; height:7px; border-radius:50%; background:#22c55e; animation:sb-blink 2.5s ease-in-out infinite; box-shadow:0 0 6px #22c55e; }

                .sb-section { padding:16px 20px 8px; font-size:10px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.2); position:relative; z-index:1; }
                .sb-nav { flex:1; padding:0 10px; display:flex; flex-direction:column; gap:3px; overflow-y:auto; position:relative; z-index:1; }

                .sb-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:11px; font-size:13px; font-weight:400; text-decoration:none; color:rgba(255,255,255,0.45); position:relative; overflow:hidden; transition:color 0.2s,background 0.2s; border:1px solid transparent; }
                .sb-item:hover { color:rgba(255,255,255,0.85); background:rgba(255,255,255,0.05); }
                .sb-item.active { color:#a5b4fc; background:rgba(99,102,241,0.12); border-color:rgba(99,102,241,0.18); font-weight:500; }
                .sb-item-bar { position:absolute; left:0; top:50%; transform:translateY(-50%); width:3px; height:18px; border-radius:0 3px 3px 0; background:linear-gradient(180deg,#818cf8,#38bdf8); box-shadow:0 0 8px rgba(99,102,241,0.6); }
                .sb-item svg { width:16px; height:16px; flex-shrink:0; transition:color 0.2s; }
                .sb-item:not(.active) svg { color:rgba(255,255,255,0.3); }
                .sb-item.active svg { color:#818cf8; }
                .sb-item:hover:not(.active) svg { color:rgba(255,255,255,0.6); }
                .sb-item-chevron { margin-left:auto; width:12px; height:12px; color:rgba(99,102,241,0.4); }

                .sb-badge { min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:#f43f5e; color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; animation:sb-pulse 2s ease-in-out infinite; margin-left:auto; }
                .sb-bell-dot { width:7px; height:7px; border-radius:50%; background:#f43f5e; position:absolute; top:-1px; right:-1px; box-shadow:0 0 6px #f43f5e; animation:sb-pulse 1.5s ease-in-out infinite; }

                .sb-loading { display:flex; align-items:center; gap:8px; padding:12px; color:rgba(255,255,255,0.25); font-size:13px; }
                .sb-loading svg { animation:spin 1s linear infinite; width:14px; height:14px; }

                .sb-footer { padding:10px; border-top:1px solid rgba(255,255,255,0.06); position:relative; z-index:1; }
                .sb-logout { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:11px; font-size:13px; font-weight:400; color:rgba(255,255,255,0.3); background:none; border:none; cursor:pointer; transition:color 0.2s,background 0.2s; }
                .sb-logout:hover { color:#f87171; background:rgba(248,113,113,0.08); }
                .sb-logout svg { width:16px; height:16px; flex-shrink:0; }

                @media (min-width:1024px) { .sb-close { display:none; } }
            `}</style>

            <div className="sb-wrap">
                <div className="sb-orb" />
                <div className="sb-orb2" />

                {/* Brand */}
                <div className="sb-brand">
                    <div className="sb-logo">
                        <div>
                            <div className="sb-logo-name">LIVEDIGIT</div>
                            <div className="sb-logo-sub">Management System</div>
                        </div>
                    </div>
                    <button onClick={() => setMobileOpen(false)} className="sb-close">
                        <XIcon size={18} className="text-slate-100" />
                    </button>
                </div>

                {/* User card */}
                {userName && (
                    <div className="sb-user">
                        <div className="sb-avatar">{avatarContent}</div>
                        <div>
                            <div className="sb-user-name">{userName}</div>
                            <div className="sb-user-role">{role === "ADMIN" ? "Administrator" : "Employee"}</div>
                        </div>
                        <div className="sb-live" />
                    </div>
                )}

                <div className="sb-section">Navigation</div>

                {/* Nav */}
                <nav className="sb-nav">
                    {loading ? (
                        <div className="sb-loading"><Loader2 /><span>Loading...</span></div>
                    ) : (
                        navItems.map((item) => {
                            const isActive  = pathname.startsWith(item.href)
                            const hasUnread = (item.badge ?? 0) > 0

                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => handleNavClick(item.href)}
                                    className={`sb-item ${isActive ? "active" : ""}`}
                                >
                                    {isActive && <div className="sb-item-bar" />}

                                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                        <item.icon />
                                        {hasUnread && !isActive && (
                                            <span className="sb-bell-dot" />
                                        )}
                                    </div>

                                    <span style={{ flex: 1 }}>{item.name}</span>

                                    {hasUnread && !isActive
                                        ? <span className="sb-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                                        : isActive
                                            ? <ChevronRightIcon className="sb-item-chevron" />
                                            : null
                                    }
                                </Link>
                            )
                        })
                    )}
                </nav>

                {/* Logout */}
                <div className="sb-footer">
                    <button onClick={handleLogout} className="sb-logout">
                        <LogOutIcon /><span>Log out</span>
                    </button>
                </div>
            </div>
        </>
    )

    return (
        <>
            {/* ── Mobile top bar ── */}
            <div
                className="lg:hidden fixed top-0 left-0 z-50 flex items-center w-full h-12"
                style={{ background: "rgb(10, 13, 26)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 ml-2 flex items-center justify-center"
                >
                    <MenuIcon size={18} color="white" />
                </button>
                <div className="ml-auto mr-2">
                    <NotificationBell />
                </div>
            </div>

            {/* ── Mobile overlay ── */}
            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden"
                    style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
                />
            )}

            {/* ── Desktop sidebar ── */}
            <aside className="hidden lg:block h-full w-64 shrink-0">{sidebarContent}</aside>

            {/* ── Mobile sidebar drawer ── */}
            <aside
                className="lg:hidden"
                style={{
                    position: "fixed", inset: "0 auto 0 0", width: "272px", zIndex: 50,
                    transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
                    transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
                }}
            >
                {sidebarContent}
            </aside>
        </>
    )
}

export default Sidebar