import { useCallback, useEffect, useRef, useState } from 'react'
import {
    BellIcon, PlusIcon, Trash2Icon, XIcon,
    Loader2Icon, ImageIcon, AlertTriangleIcon,
    InfoIcon, MegaphoneIcon, ZoomInIcon, CakeIcon,
} from 'lucide-react'
import { useAuth }              from '../context/authContext'
import api                      from '../api/axios'
import toast                    from 'react-hot-toast'
import Loading                  from '../components/Loading'
import usePolling               from '../hooks/usePolling'
import {
    showNotification,
    showBackgroundNotification,
    requestNotificationPermission,
    playNotificationSound,
} from '../utils/notifications'

// ─── Config ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL        = 60_000    // tab visible
const HIDDEN_POLL_INTERVAL = 300_000   // tab in background (keeps background alerts, but rarely)

const PRIORITY = {
    NORMAL:    { label: 'Normal',    color: 'bg-slate-500/15 text-slate-400',  dot: 'bg-slate-400',  icon: InfoIcon          },
    IMPORTANT: { label: 'Important', color: 'bg-amber-500/15 text-amber-400',  dot: 'bg-amber-400',  icon: AlertTriangleIcon },
    URGENT:    { label: 'Urgent',    color: 'bg-rose-500/15 text-rose-400',    dot: 'bg-rose-500',   icon: MegaphoneIcon     },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m    = Math.floor(diff / 60000)
    if (m < 1)  return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

const getHighestPriority = (items) => {
    if (items.some((a) => a.priority === 'URGENT'))    return 'URGENT'
    if (items.some((a) => a.priority === 'IMPORTANT')) return 'IMPORTANT'
    return 'NORMAL'
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────

const ImageLightbox = ({ src, alt, onClose }) => {
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handleKey)
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', handleKey)
            document.body.style.overflow = ''
        }
    }, [onClose])

    return (
        <div
            className='fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center'
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className='absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10'
            >
                <XIcon className='w-5 h-5' />
            </button>

            {alt && (
                <p className='absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm truncate max-w-[60vw]'>
                    {alt}
                </p>
            )}

            {!loaded && <Loader2Icon className='w-8 h-8 text-white/40 animate-spin absolute' />}

            <img
                src={src}
                alt={alt}
                onLoad={() => setLoaded(true)}
                onClick={(e) => e.stopPropagation()}
                style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
                className='max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl'
            />

            <p className='absolute bottom-4 text-white/30 text-xs'>Tap outside to close</p>
        </div>
    )
}

// ─── Create Form ──────────────────────────────────────────────────────────────

const CreateAnnouncementForm = ({ onSuccess }) => {
    const [open,     setOpen]     = useState(false)
    const [loading,  setLoading]  = useState(false)
    const [title,    setTitle]    = useState('')
    const [message,  setMessage]  = useState('')
    const [priority, setPriority] = useState('NORMAL')
    const [preview,  setPreview]  = useState(null)
    const [imgB64,   setImgB64]   = useState('')
    const fileRef = useRef()

    const handleImage = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
        const reader = new FileReader()
        reader.onload = (ev) => { setPreview(ev.target.result); setImgB64(ev.target.result) }
        reader.readAsDataURL(file)
    }

    const reset = () => {
        setTitle(''); setMessage(''); setPriority('NORMAL'); setPreview(null); setImgB64('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            await api.post('/announcements', { title, message, priority, imageBase64: imgB64 || undefined })
            toast.success('Announcement posted!')
            setOpen(false)
            reset()
            onSuccess()
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return (
        <button onClick={() => setOpen(true)} className='btn-primary flex items-center gap-2'>
            <PlusIcon className='w-4 h-4' /> New Announcement
        </button>
    )

    return (
        <div
            className='fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto'
            onClick={() => setOpen(false)}
        >
            <div
                className='bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 animate-fade-in'
                onClick={(e) => e.stopPropagation()}
            >
                <div className='flex items-center justify-between p-6 pb-0'>
                    <div>
                        <h2 className='text-lg font-semibold text-slate-900'>New Announcement</h2>
                        <p className='text-xs text-slate-400 mt-0.5'>Notify all employees</p>
                    </div>
                    <button onClick={() => setOpen(false)} className='p-2 rounded-lg hover:bg-slate-100 text-slate-400'>
                        <XIcon className='w-5 h-5' />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className='p-6 space-y-4'>
                    <div>
                        <label className='block text-sm font-medium text-slate-700 mb-1.5'>Title</label>
                        <input
                            value={title} onChange={(e) => setTitle(e.target.value)}
                            required placeholder='e.g. Office Holiday Notice'
                            className='text-slate-800'
                        />
                    </div>

                    <div>
                        <label className='block text-sm font-medium text-slate-700 mb-1.5'>Priority</label>
                        <div className='flex gap-2'>
                            {Object.entries(PRIORITY).map(([key, p]) => (
                                <button
                                    key={key} type='button'
                                    onClick={() => setPriority(key)}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                                        priority === key
                                            ? `${p.color} border-current`
                                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className='block text-sm font-medium text-slate-700 mb-1.5'>Message</label>
                        <textarea
                            value={message} onChange={(e) => setMessage(e.target.value)}
                            required rows={4} className='resize-none text-slate-800'
                            placeholder='Write your announcement...'
                        />
                    </div>

                    <div>
                        <label className='block text-sm font-medium text-slate-700 mb-1.5'>
                            Image <span className='text-slate-400 font-normal'>(optional, max 5MB)</span>
                        </label>
                        {preview ? (
                            <div className='relative rounded-xl overflow-hidden border border-slate-200'>
                                <img src={preview} alt='preview' className='w-full h-48 object-cover' />
                                <button
                                    type='button'
                                    onClick={() => { setPreview(null); setImgB64(''); fileRef.current.value = '' }}
                                    className='absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80'
                                >
                                    <XIcon className='w-4 h-4' />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileRef.current?.click()}
                                className='border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors'
                            >
                                <ImageIcon className='w-8 h-8 text-slate-300' />
                                <p className='text-sm text-slate-400'>Click to upload image</p>
                                <p className='text-xs text-slate-300'>PNG, JPG, WEBP up to 5MB</p>
                            </div>
                        )}
                        <input ref={fileRef} type='file' accept='image/*' className='hidden' onChange={handleImage} />
                    </div>

                    <div className='flex gap-3 pt-2'>
                        <button type='button' onClick={() => setOpen(false)} className='btn-secondary flex-1'>Cancel</button>
                        <button type='submit' disabled={loading} className='btn-primary flex-1 flex items-center justify-center gap-2'>
                            {loading
                                ? <><Loader2Icon className='w-4 h-4 animate-spin' /> Posting…</>
                                : <><BellIcon className='w-4 h-4' /> Post</>
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Announcement Card ────────────────────────────────────────────────────────

const AnnouncementCard = ({ item, isAdmin, onDelete, isNew }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const p    = PRIORITY[item.priority] || PRIORITY.NORMAL
    const Icon = p.icon

    return (
        <>
            <div className={`card overflow-hidden transition-all ${isNew ? 'ring-2 ring-indigo-500/40' : ''}`}>
                {item.imageUrl?.trim() && (
                    <div
                        className='w-full h-52 overflow-hidden bg-slate-800 relative group cursor-pointer'
                        onClick={() => setLightboxOpen(true)}
                    >
                        <img
                            src={item.imageUrl} alt={item.title}
                            className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-105'
                            onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
                        />
                        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center'>
                            <div className='opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm font-medium'>
                                <ZoomInIcon className='w-4 h-4' /> View image
                            </div>
                        </div>
                    </div>
                )}

                <div className='p-5'>
                    <div className='flex items-start justify-between gap-3 mb-3'>
                        <div className='flex items-center gap-2 flex-wrap'>
                            {item.type === 'BIRTHDAY' && (
                                <span className='inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-pink-500/15 text-pink-400'>
                                    <CakeIcon className='w-3 h-3' /> Birthday
                                </span>
                            )}
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${p.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${p.dot} ${item.priority === 'URGENT' ? 'animate-pulse' : ''}`} />
                                {p.label}
                            </span>
                            {isNew && (
                                <span className='inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium animate-pulse'>
                                    NEW
                                </span>
                            )}
                        </div>
                        <div className='flex items-center gap-2 shrink-0'>
                            <span className='text-xs text-slate-500'>{timeAgo(item.createdAt)}</span>
                            {isAdmin && (
                                <button
                                    onClick={() => onDelete(item._id)}
                                    className='p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors'
                                >
                                    <Trash2Icon className='w-3.5 h-3.5' />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className='flex items-start gap-2 mb-2'>
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${
                            item.priority === 'URGENT'    ? 'text-rose-400'  :
                            item.priority === 'IMPORTANT' ? 'text-amber-400' : 'text-slate-400'
                        }`} />
                        <h3 className='text-base font-semibold text-slate-100 leading-snug'>{item.title}</h3>
                    </div>

                    <p className='text-sm text-slate-400 leading-relaxed whitespace-pre-wrap pl-6'>{item.message}</p>

                    <p className='text-xs text-slate-600 mt-3 pl-6'>
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        })}
                    </p>
                </div>
            </div>

            {lightboxOpen && (
                <ImageLightbox src={item.imageUrl} alt={item.title} onClose={() => setLightboxOpen(false)} />
            )}
        </>
    )
}

// ─── Notification Banner ──────────────────────────────────────────────────────

const NotificationPermissionBanner = () => {
    const [show, setShow] = useState(
        'Notification' in window && Notification.permission === 'default'
    )

    if (!show) return null

    const request = async () => {
        const perm = await requestNotificationPermission()
        if (perm === 'granted') {
            toast.success('Notifications enabled!')
            playNotificationSound('NORMAL')
        }
        setShow(false)
    }

    return (
        <div className='mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300'>
            <div className='flex items-center gap-2'>
                <BellIcon className='w-4 h-4 shrink-0' />
                <span>Enable notifications to get alerted even when you're not on this page.</span>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
                <button onClick={request} className='px-3 py-1 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors'>
                    Enable
                </button>
                <button onClick={() => setShow(false)} className='p-1 hover:text-white transition-colors'>
                    <XIcon className='w-4 h-4' />
                </button>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Announcements = () => {
    const { user } = useAuth()
    const [announcements, setAnnouncements] = useState([])
    const [loading,       setLoading]       = useState(true)

    const lastSeenRef  = useRef(localStorage.getItem('announcementLastSeen') || '')
    const [lastSeen,   setLastSeen]  = useState(lastSeenRef.current)
    const knownIdsRef  = useRef(new Set())
    const isAdmin      = user?.role === 'ADMIN'

    const fetchAnnouncements = useCallback(async ({ silent = false } = {}) => {
        try {
            const { data: { data = [] } } = await api.get('/announcements')

            if (!silent) {
                setAnnouncements(data)
                data.forEach((a) => knownIdsRef.current.add(a._id))
                setLoading(false)
                return
            }

            const newItems = data.filter((a) => !knownIdsRef.current.has(a._id))
            if (!newItems.length) return

            const priority = getHighestPriority(newItems)
            const title    = newItems.length === 1
                ? newItems[0].title
                : `${newItems.length} new announcements`
            const body     = newItems.length === 1
                ? newItems[0].message
                : newItems.map((a) => a.title).join(', ')

            // If tab is visible → play sound + show notification
            // If tab is hidden  → show notification via service worker (shows even if tab is closed)
            if (document.visibilityState === 'visible') {
                await showNotification(title, body, priority)
            } else {
                await showBackgroundNotification(title, body, priority)
            }

            newItems.forEach((a) => knownIdsRef.current.add(a._id))
            setAnnouncements(data)

        } catch (err) {
            if (!silent) {
                toast.error(err.response?.data?.error || err.message)
                setLoading(false)
            }
        }
    }, [])

    useEffect(() => {
        fetchAnnouncements({ silent: false })

        const now = new Date().toISOString()
        localStorage.setItem('announcementLastSeen', now)
        lastSeenRef.current = now
        setLastSeen(now)

        requestNotificationPermission()
    }, [fetchAnnouncements])

    // Visibility-aware polling: 60s while visible, 5 min in background.
    usePolling(() => fetchAnnouncements({ silent: true }), {
        intervalMs:       POLL_INTERVAL,
        hiddenIntervalMs: HIDDEN_POLL_INTERVAL,
        immediate:        false,
    })

    const handleDelete = async (id) => {
        if (!confirm('Delete this announcement?')) return
        try {
            await api.delete(`/announcements/${id}`)
            toast.success('Deleted')
            knownIdsRef.current.delete(id)
            setAnnouncements((prev) => prev.filter((a) => a._id !== id))
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        }
    }

    const handlePostSuccess = useCallback(async () => {
        const res = await api.get('/announcements').catch(() => null)
        if (!res) return
        const data = res.data.data || []
        data.forEach((a) => knownIdsRef.current.add(a._id))
        setAnnouncements(data)
    }, [])

    if (loading) return <Loading />

    return (
        <div className='animate-fade-in'>
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
                <div>
                    <div className='flex items-center gap-3'>
                        <h1 className='text-3xl text-slate-100'>Announcements</h1>
                        {announcements.length > 0 && (
                            <span className='text-xs px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-400 font-medium'>
                                {announcements.length}
                            </span>
                        )}
                    </div>
                    <p className='page-subtitle'>
                        {isAdmin
                            ? 'Post updates and notices to all employees'
                            : 'Stay updated with company notices'}
                    </p>
                </div>
                {isAdmin && <CreateAnnouncementForm onSuccess={handlePostSuccess} />}
            </div>

            <NotificationPermissionBanner />

            {announcements.length === 0 ? (
                <div className='card p-16 flex flex-col items-center justify-center text-center gap-4'>
                    <div className='w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center'>
                        <BellIcon className='w-8 h-8 text-indigo-400' />
                    </div>
                    <div>
                        <h3 className='text-slate-200 font-semibold'>No announcements yet</h3>
                        <p className='text-slate-500 text-sm mt-1'>
                            {isAdmin
                                ? 'Post your first announcement using the button above'
                                : 'Check back later for company updates'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className='space-y-4'>
                    {announcements.map((item) => (
                        <AnnouncementCard
                            key={item._id}
                            item={item}
                            isAdmin={isAdmin}
                            onDelete={handleDelete}
                            isNew={lastSeen ? new Date(item.createdAt) > new Date(lastSeen) : false}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default Announcements