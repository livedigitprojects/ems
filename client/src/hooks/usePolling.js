import { useEffect, useRef } from "react"

const usePolling = (
    callback,
    { intervalMs, hiddenIntervalMs = null, enabled = true, immediate = true } = {}
) => {
    const cbRef = useRef(callback)
    useEffect(() => { cbRef.current = callback })

    useEffect(() => {
        if (!enabled) return

        let timer   = null
        let stopped = false

        const isHidden = () => document.visibilityState === "hidden"
        const run = async () => {
            try { await cbRef.current() } catch { /* callers handle errors */ }
        }

        const schedule = () => {
            clearTimeout(timer)
            const delay = isHidden() ? hiddenIntervalMs : intervalMs
            if (stopped || delay == null) return
            timer = setTimeout(async () => {
                await run()
                schedule()
            }, delay)
        }

        const onVisibility = () => {
            if (!isHidden()) run()
            schedule()
        }

        if (immediate) run()
        schedule()
        document.addEventListener("visibilitychange", onVisibility)

        return () => {
            stopped = true
            clearTimeout(timer)
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [intervalMs, hiddenIntervalMs, enabled, immediate])
}

export default usePolling