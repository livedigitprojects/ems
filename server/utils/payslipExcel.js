import ExcelJS from "exceljs"

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

const MONEY_FMT = "#,##0.00"

/**
 * Builds the payslip workbook for exactly the rows it is given (the caller has
 * already applied the admin's month filters) and returns it as a Buffer.
 *
 * `rows` are plain objects: { employee: {employeeId, firstName, lastName, department, position},
 *                             month, year, basicSalary, allowances, workingDays, presentDays,
 *                             absentDays, lopDays, lopAmount, earnedBasic, netSalary }
 */
export const buildPayslipWorkbookBuffer = async (rows, { periodLabel = "All periods" } = {}) => {
    const wb = new ExcelJS.Workbook()
    wb.creator = "Livedigit EMS"
    wb.created = new Date()

    const ws = wb.addWorksheet("Payslips", { views: [{ state: "frozen", ySplit: 1 }] })

    ws.columns = [
        { header: "Employee ID",     key: "empCode",     width: 14 },
        { header: "Employee Name",   key: "name",        width: 26 },
        { header: "Department",      key: "department",  width: 18 },
        { header: "Position",        key: "position",    width: 22 },
        { header: "Period",          key: "period",      width: 16 },
        { header: "Basic Salary",    key: "basicSalary", width: 15, style: { numFmt: MONEY_FMT } },
        { header: "Allowances",      key: "allowances",  width: 14, style: { numFmt: MONEY_FMT } },
        { header: "Working Days",    key: "workingDays", width: 13 },
        { header: "Present Days",    key: "presentDays", width: 13 },
        { header: "Absent Days",     key: "absentDays",  width: 12 },
        { header: "LOP Days",        key: "lopDays",     width: 10 },
        { header: "LOP Amount",      key: "lopAmount",   width: 14, style: { numFmt: MONEY_FMT } },
        { header: "Earned Basic",    key: "earnedBasic", width: 15, style: { numFmt: MONEY_FMT } },
        { header: "Net Salary",      key: "netSalary",   width: 15, style: { numFmt: MONEY_FMT } },
    ]

    const header = ws.getRow(1)
    header.font      = { bold: true, color: { argb: "FFFFFFFF" } }
    header.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3730A3" } }
    header.alignment = { vertical: "middle", horizontal: "center" }
    header.height    = 22

    const totals = { basicSalary: 0, allowances: 0, lopAmount: 0, earnedBasic: 0, netSalary: 0 }
    const num = (v) => Number(v) || 0

    for (const r of rows) {
        const e = r.employee || {}
        ws.addRow({
            empCode:     e.employeeId || "",
            name:        `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
            department:  e.department || "",
            position:    e.position   || "",
            period:      `${MONTH_NAMES[r.month - 1] ?? r.month} ${r.year}`,
            basicSalary: num(r.basicSalary),
            allowances:  num(r.allowances),
            workingDays: num(r.workingDays),
            presentDays: num(r.presentDays),
            absentDays:  num(r.absentDays),
            lopDays:     num(r.lopDays),
            lopAmount:   num(r.lopAmount),
            earnedBasic: num(r.earnedBasic),
            netSalary:   num(r.netSalary),
        })
        for (const k of Object.keys(totals)) totals[k] += num(r[k])
    }

    // Totals sit below a blank spacer row so the data block stays a clean table.
    ws.addRow({})
    const totalRow = ws.addRow({ name: `TOTAL (${rows.length} payslip${rows.length === 1 ? "" : "s"})`, period: periodLabel, ...totals })
    totalRow.font = { bold: true }
    totalRow.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, bottom: { style: "double" } }
    })

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: ws.columns.length } }

    return Buffer.from(await wb.xlsx.writeBuffer())
}