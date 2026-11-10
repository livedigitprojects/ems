
import { useState } from "react"
import { format } from "date-fns"
import { Download, Pencil } from "lucide-react"
import EditPayslipModal from "./EditPayslipModal"

const PayslipList = ({ payslips, isAdmin, onRefresh, refreshing = false, className = "" }) => {
    const [editing, setEditing] = useState(null)

    return (
        <>
            <div className={`card overflow-hidden flex flex-col transition-opacity ${refreshing ? "opacity-60" : ""} ${className}`}>
                {/* Scrolls both ways inside the card; header row stays pinned */}
                <div className="overflow-auto max-h-[65vh] lg:max-h-none lg:flex-1 lg:min-h-0">
                    <table className="table-modern min-w-[760px]">
                        <thead className="sticky top-0 z-10 [&_th]:bg-[#161b36] [&_th]:whitespace-nowrap">
                            <tr>
                                {isAdmin && <th>Employee</th>}
                                <th>Period</th>
                                <th>Basic Salary</th>
                                <th>Allowances</th>
                                <th>LOP Deduction</th>
                                <th>Net Salary</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payslips.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={isAdmin ? 7 : 6}
                                        className="text-center py-12 text-slate-400"
                                    >
                                        No payslips found
                                    </td>
                                </tr>
                            ) : (
                                payslips.map((payslip) => (
                                    <tr key={payslip._id || payslip.id}>
                                        {isAdmin && (
                                            <td className="text-slate-300 font-medium">
                                                {payslip.employee?.firstName} {payslip.employee?.lastName}
                                            </td>
                                        )}
                                        <td className="text-slate-400">
                                            {format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")}
                                        </td>
                                        <td className="text-slate-400">
                                            ₹ {payslip.basicSalary?.toLocaleString("en-IN")}
                                        </td>
                                        <td className="text-green-500 font-medium">
                                            + ₹ {payslip.allowances?.toLocaleString("en-IN")}
                                        </td>
                                        <td className="text-rose-400 font-medium">
                                            {payslip.lopDays > 0 ? (
                                                <>
                                                    – ₹ {payslip.lopAmount?.toLocaleString("en-IN")}
                                                    <span className="ml-1.5 text-xs bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-full">
                                                        {payslip.lopDays}d LOP
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="text-slate-100 font-semibold">
                                            ₹ {payslip.netSalary?.toLocaleString("en-IN")}
                                        </td>
                                        <td className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        window.open(`/print/payslips/${payslip._id || payslip.id}`)
                                                    }
                                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors ring-1 ring-blue-600/10"
                                                >
                                                    <Download className="w-3 h-3 mr-1.5" />
                                                    Download
                                                </button>

                                                {isAdmin && (
                                                    <button
                                                        onClick={() => setEditing(payslip)}
                                                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors ring-1 ring-amber-600/10"
                                                    >
                                                        <Pencil className="w-3 h-3 mr-1.5" />
                                                        Edit
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editing && (
                <EditPayslipModal
                    payslip={editing}
                    onClose={() => setEditing(null)}
                    onSuccess={onRefresh}
                />
            )}
        </>
    )
}

export default PayslipList