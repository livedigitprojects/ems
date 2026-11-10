// Pure helpers for the Payslips month filter (kept out of the component file for Fast Refresh).
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// month objects are { m: 1-12, y: 2026 }
export const shift = ({ m, y }, delta) => {
    const idx = y * 12 + (m - 1) + delta
    return { y: Math.floor(idx / 12), m: (idx % 12) + 1 }
}
export const key   = ({ m, y }) => `${y}-${String(m).padStart(2, "0")}`
export const label = ({ m, y }) => `${MONTHS[m - 1]} ${y}`
export const cmp   = (a, b)     => a.y * 12 + a.m - (b.y * 12 + b.m)
export const today = ()         => { const n = new Date(); return { m: n.getMonth() + 1, y: n.getFullYear() } }

export const defaultPayslipFilter = () => {
    const cur = today()
    return { mode: "all", month: cur, from: shift(cur, -2), to: cur, last: 3 }
}

/** Turns the UI state into API params, a readable label, or a validation error. */
export const resolvePayslipFilter = (f) => {
    switch (f.mode) {
        case "month":
            return { params: { from: key(f.month), to: key(f.month) }, label: label(f.month) }
        case "range":
            if (cmp(f.from, f.to) > 0) return { error: "The 'From' month must be the same as or before the 'To' month." }
            return { params: { from: key(f.from), to: key(f.to) }, label: `${label(f.from)} - ${label(f.to)}` }
        case "last": {
            const n = Number(f.last)
            if (!Number.isInteger(n) || n < 1 || n > 36) return { error: "Enter a number of months between 1 and 36." }
            const cur = today(), from = shift(cur, -(n - 1))
            return { params: { from: key(from), to: key(cur) }, label: `Last ${n} month${n > 1 ? "s" : ""} (${label(from)} - ${label(cur)})` }
        }
        default:
            return { params: {}, label: "All periods" }
    }
}