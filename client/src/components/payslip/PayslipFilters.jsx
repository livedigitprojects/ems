import { DownloadIcon, FilterXIcon, Loader2Icon } from "lucide-react"
import { MONTHS, defaultPayslipFilter } from "./payslipFilter"

const selectCls =
    "bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm px-2.5 py-2 " +
    "focus:outline-none focus:border-indigo-500"

const MonthPicker = ({ value, onChange }) => {
    const thisYear = new Date().getFullYear()
    const years = Array.from({ length: 8 }, (_, i) => thisYear - 5 + i)
    if (!years.includes(value.y)) years.push(value.y)
    return (
        <div className="flex gap-1.5">
            <select value={value.m} onChange={(e) => onChange({ ...value, m: Number(e.target.value) })} className={selectCls}>
                {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
            <select value={value.y} onChange={(e) => onChange({ ...value, y: Number(e.target.value) })} className={selectCls}>
                {years.sort().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    )
}

const MODES = [
    { id: "all",   text: "All" },
    { id: "month", text: "Month" },
    { id: "range", text: "Range" },
    { id: "last",  text: "Last N months" },
]

const PayslipFilters = ({ filter, onChange, error, periodLabel, count, exporting, onExport }) => {
    const set = (patch) => onChange({ ...filter, ...patch })

    return (
        <div className="card p-3 sm:p-4 mb-4 shrink-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                {/* Mode switch */}
                <div className="inline-flex rounded-lg bg-slate-800/80 p-1 border border-slate-700">
                    {MODES.map((m) => (
                        <button key={m.id} type="button" onClick={() => set({ mode: m.id })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                filter.mode === m.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                            {m.text}
                        </button>
                    ))}
                </div>

                {/* Mode-specific controls */}
                {filter.mode === "month" && <MonthPicker value={filter.month} onChange={(month) => set({ month })} />}

                {filter.mode === "range" && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>From</span><MonthPicker value={filter.from} onChange={(from) => set({ from })} />
                        <span>to</span><MonthPicker value={filter.to} onChange={(to) => set({ to })} />
                    </div>
                )}

                {filter.mode === "last" && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>Last</span>
                        <input type="number" min="1" max="36" step="1" value={filter.last}
                               onChange={(e) => set({ last: e.target.value })}
                               className={`${selectCls} w-20`} />
                        <span>months</span>
                        {[3, 6, 12].map((n) => (
                            <button key={n} type="button" onClick={() => set({ last: n })}
                                className={`px-2 py-1 rounded-md border text-xs ${
                                    Number(filter.last) === n ? "border-indigo-500 text-indigo-300" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
                                {n}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    {filter.mode !== "all" && (
                        <button type="button" onClick={() => onChange(defaultPayslipFilter())}
                            className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 flex items-center gap-1.5">
                            <FilterXIcon className="w-3.5 h-3.5" /> Clear
                        </button>
                    )}
                    <button type="button" onClick={onExport} disabled={exporting || !!error || count === 0}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            exporting || error || count === 0
                                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                                : "bg-emerald-600 text-white hover:bg-emerald-500"}`}>
                        {exporting ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <DownloadIcon className="w-3.5 h-3.5" />}
                        Export to Excel
                    </button>
                </div>
            </div>

            {error ? (
                <p className="text-xs text-rose-400">{error}</p>
            ) : (
                <p className="text-xs text-slate-500">
                    Showing <span className="text-slate-300 font-medium">{count}</span> payslip{count === 1 ? "" : "s"}
                    {" "}for <span className="text-slate-300 font-medium">{periodLabel}</span>.
                    The Excel export contains exactly these records.
                </p>
            )}
        </div>
    )
}

export default PayslipFilters