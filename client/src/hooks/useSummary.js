import { useEffect, useState } from "react"
import api from "../api/axios"
import usePolling from "./usePolling"

const EMPTY = {
    unreadNotifications:    0,
    unreadAnnouncements:    0,
    pendingRegularizations: 0,
    pendingLeaves:          0,
    unreadLetters:          0,
}

const POLL_MS = 60_000

let current       = EMPTY
let inflight      = null
let lastFetchedAt = 0
const listeners   = new Set()

const emit = () => listeners.forEach((fn) => fn(current))

export const patchSummary = (patch) => {
    current = { ...current, ...patch }
    emit()
}

export const resetSummary = () => {
    current = EMPTY
    lastFetchedAt = 0
    emit()
}

export const refreshSummary = async ({ force = false } = {}) => {
    if (inflight) return inflight
    if (!force && Date.now() - lastFetchedAt < 5000) return

    inflight = (async () => {
        try {
            const params = {}
            const since      = localStorage.getItem("announcementLastSeen")
            const regSince   = localStorage.getItem("regularizationLastSeen")
            const leaveSince = localStorage.getItem("leaveLastSeen")
            if (since)      params.since      = since
            if (regSince)   params.regSince   = regSince
            if (leaveSince) params.leaveSince = leaveSince
            const { data } = await api.get("/notifications/summary", { params })
            current       = { ...EMPTY, ...data }
            lastFetchedAt = Date.now()
            emit()
        } catch {
            /* keep last known counts */
        } finally {
            inflight = null
        }
    })()

    return inflight
}

const useSummary = (enabled = true) => {
    const [summary, setSummary] = useState(current)

    useEffect(() => {
        listeners.add(setSummary)
        setSummary(current)
        return () => { listeners.delete(setSummary) }
    }, [])

    useEffect(() => { if (!enabled) resetSummary() }, [enabled])

    usePolling(() => refreshSummary(), { intervalMs: POLL_MS, enabled })

    return { summary, patchSummary, refresh: () => refreshSummary({ force: true }) }
}

export default useSummary