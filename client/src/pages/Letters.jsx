import { useEffect, useState, useCallback } from "react";
import {
  MailIcon, SendIcon, Loader2Icon, Trash2Icon, EyeIcon,
  XIcon, ChevronDownIcon, FileTextIcon, AlertTriangleIcon,
  StarIcon, DownloadIcon, UserXIcon, BriefcaseIcon,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/authContext";

const COMPANY = {
  name:     "LiveDigit Technologies Pvt. Ltd.",
  tagline:  "Grow Your Business Online",
  email:    "hrsupport@Livedigit.in",
  location: "Visakhapatnam & Hyderabad",
  website:  "www.livedigit.in",
  phone:    "+91 98765 43210",
  cin:      "U72900TG2020PTC145678",
  gstin:    "36AABCL1234F1ZS",
  logo:     "/logo.png",
}

const TEMPLATES = [
  {
    key:   "OFFER_LETTER",
    label: "Offer Letter",
    title: "JOB OFFER LETTER",
    icon:  FileTextIcon,
    color: "text-green-400 bg-green-500/10 border-green-500/20",
    desc:  "Formal job offer with position and terms",
    gradient: "linear-gradient(135deg,#e8f5e9 0%,#f1f8e9 100%)",
    accent: "#2e7d32",
    preview: (emp, custom) =>
      `Dear ${emp || "[Employee]"},\n\nWe are pleased to offer you the position discussed.\n\n${custom || "[Your custom message here]"}\n\nWarm regards,\nHR Department`,
  },
  {
    key:   "WARNING_LETTER",
    label: "Warning Letter",
    title: "WARNING LETTER",
    icon:  AlertTriangleIcon,
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    desc:  "Official warning for disciplinary matters",
    gradient: "linear-gradient(135deg,#fff8e1 0%,#fff3e0 100%)",
    accent: "#e65100",
    preview: (emp, custom) =>
      `Dear ${emp || "[Employee]"},\n\nThis letter serves as an official warning.\n\n${custom || "[Your custom message here]"}\n\nRegards,\nHR Department`,
  },
  {
    key:   "APPRECIATION_LETTER",
    label: "Appreciation Letter",
    title: "APPRECIATION LETTER",
    icon:  StarIcon,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    desc:  "Recognise outstanding contributions",
    gradient: "linear-gradient(135deg,#e8eaf6 0%,#ede7f6 100%)",
    accent: "#283593",
    preview: (emp, custom) =>
      `Dear ${emp || "[Employee]"},\n\nWe sincerely appreciate your outstanding contribution.\n\n${custom || "[Your custom message here]"}\n\nWith appreciation,\nHR Department`,
  },
  {
    key:   "TERMINATION_LETTER",
    label: "Termination Letter",
    title: "TERMINATION LETTER",
    icon:  UserXIcon,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    desc:  "Employment termination with final settlement",
    gradient: "linear-gradient(135deg,#fce4ec 0%,#ffeeff 100%)",
    accent: "#b71c1c",
    preview: (emp, custom) =>
      `Dear ${emp || "[Employee]"},\n\nWe regret to inform you that your employment is being terminated.\n\n${custom || "[Your custom message here]"}\n\nRegards,\nHR Department`,
  },
  {
    key:   "EXPERIENCE_LETTER",
    label: "Experience Letter",
    title: "EXPERIENCE LETTER",
    icon:  BriefcaseIcon,
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    desc:  "Employment tenure certification for future use",
    gradient: "linear-gradient(135deg,#e1f5fe 0%,#e0f7fa 100%)",
    accent: "#01579b",
    preview: (emp, custom) =>
      `To Whomsoever It May Concern,\n\nThis certifies that ${emp || "[Employee]"} was employed with our organisation.\n\n${custom || "[Your custom message here]"}\n\nYours faithfully,\nHR Department`,
  },
]

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  })

const fmtDateShort = (iso) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
}

// ─── PDF Builder ──────────────────────────────────────────────────────────────
const buildLetterHTML = (letter) => {
  const tpl    = TEMPLATES.find(t => t.key === letter.templateType)
  const title  = tpl?.title || letter.templateType.replace(/_/g, " ")
  const accent = tpl?.accent || "#1565c0"
  const date   = fmtDateShort(letter.createdAt)

  // Render body: bold lines that look like headings (ALL CAPS or end with :), bullet lines, normal paragraphs
  const bodyHTML = letter.renderedBody
    .split("\n\n")
    .map(block => {
      const lines = block.split("\n").map(ln => ln.trim()).filter(Boolean)
      if (!lines.length) return ""

      // Detect bullet list block
      if (lines.every(ln => ln.startsWith("- ") || ln.startsWith("• "))) {
        const items = lines.map(ln => `<li>${ln.replace(/^[-•]\s*/, "")}</li>`).join("")
        return `<ul>${items}</ul>`
      }

      return lines.map(ln => {
        // Inline bold: **text**
        const formatted = ln.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        // Heading-style line: ends with nothing after a colon OR is short all-caps
        const isHeading = /^[A-Z][A-Za-z\s&]+:$/.test(ln) || (/^[A-Z\s]{4,}$/.test(ln) && ln.length < 60)
        if (isHeading) return `<p class="heading">${formatted}</p>`
        // Key-value line like "Position: Something"
        const kvMatch = ln.match(/^([A-Za-z\s]+):\s+(.+)$/)
        if (kvMatch) return `<p><strong>${kvMatch[1]}:</strong> ${kvMatch[2].replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`
        return `<p>${formatted}</p>`
      }).join("")
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${letter.subject}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{
    width:210mm;min-height:297mm;
    margin:0 auto;
    background:#e8edf2;
    font-family:'Inter',sans-serif;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }

  .page{
    width:210mm;
    min-height:297mm;
    background:#ffffff;
    display:flex;
    flex-direction:column;
    position:relative;
    overflow:hidden;
    box-shadow:0 6px 40px rgba(0,0,0,0.13);
  }

  /* ── Top-right decorative blue shape (matches screenshot) ── */
  .deco-tr{
    position:absolute;
    top:0; right:0;
    width:130px; height:130px;
    overflow:hidden;
    pointer-events:none;
    z-index:1;
  }
  .deco-tr svg{ display:block; }

  /* ── Bottom-left decorative blue shape ── */
  .deco-bl{
    position:absolute;
    bottom:0; left:0;
    width:100px; height:100px;
    overflow:hidden;
    pointer-events:none;
    z-index:1;
  }
  .deco-bl svg{ display:block; }

  /* ── Header ── */
  .header{
    padding:28px 36px 16px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    flex-shrink:0;
    position:relative;
    z-index:2;
  }
  .logo-img{height:52px;width:auto;object-fit:contain}
  .logo-fallback{
    display:none;
    align-items:center;
    gap:10px;
  }
  .logo-fallback .brand{
    font-size:22px;font-weight:800;
    color:${accent};letter-spacing:-0.5px;
  }
  .logo-fallback .tag{
    font-size:9px;color:#888;font-style:italic;margin-top:2px;
  }

  /* ── Title ── */
  .title-section{
    text-align:center;
    padding:18px 40px 4px;
    position:relative;
    z-index:2;
    flex-shrink:0;
  }
  .title-section h1{
    font-size:22px;
    font-weight:800;
    color:${accent};
    letter-spacing:1.5px;
    text-transform:uppercase;
  }

  /* ── Thin rule under title ── */
  .title-rule{
    width:100%;height:1.5px;
    background:linear-gradient(90deg,transparent,${accent}55,transparent);
    margin:10px 0 0;
    flex-shrink:0;
  }

  /* ── Date line ── */
  .date-line{
    text-align:right;
    padding:12px 40px 4px;
    font-size:11.5px;
    color:#444;
    font-weight:500;
    position:relative;z-index:2;
    flex-shrink:0;
  }

  /* ── Letter body ── */
  .letter-body{
    padding:10px 40px 20px;
    flex:1;
    font-size:12px;
    line-height:1.85;
    color:#1a1a1a;
    position:relative;z-index:2;
  }
  .letter-body p{margin-bottom:9px}
  .letter-body p.heading{
    font-weight:700;
    color:#111;
    margin-top:14px;
    margin-bottom:5px;
    font-size:12px;
  }
  .letter-body ul{
    margin:4px 0 10px 20px;
    padding:0;
  }
  .letter-body ul li{
    margin-bottom:4px;
    font-size:12px;
    line-height:1.75;
    color:#222;
  }
  .letter-body strong{color:#111}

  /* ── Signature ── */
  .sig-section{
    padding:10px 40px 16px;
    flex-shrink:0;
    position:relative;z-index:2;
  }
  .sig-rule{
    height:1px;
    background:linear-gradient(90deg,${accent}33,transparent);
    margin-bottom:14px;
  }
  .sig-row{display:flex;justify-content:space-between;align-items:flex-end}
  .sig-block{}
  .sig-line{
    width:140px;height:1px;
    background:#bbb;
    margin-bottom:5px;
    margin-top:28px;
  }
  .sig-name{font-size:10.5px;font-weight:700;color:#1a1a1a}
  .sig-role{font-size:9.5px;color:#777;margin-top:1px}

  /* ── Footer ── */
  .footer{
    border-top:1px solid #e5e7eb;
    padding:12px 36px;
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:20px;
    flex-shrink:0;
    position:relative;z-index:2;
    margin-top:auto;
  }
  .fc-item{
    display:flex;align-items:center;gap:6px;
    font-size:10px;color:#555;font-weight:500;
  }
  .fc-icon{
    width:14px;height:14px;
    background:${accent};
    border-radius:3px;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }
  .fc-icon svg{width:8px;height:8px;fill:#fff}

  /* -- Layout table: its <tfoot> repeats on every printed page and reserves
        room for the fixed footer, so text never runs underneath it -- */
  .layout{width:100%;border-collapse:collapse;flex:1}
  .layout td{padding:0;vertical-align:top}
  .footer-space{display:none}
  .sig-section{break-inside:avoid;page-break-inside:avoid}
  .letter-body p,.letter-body li{break-inside:avoid;page-break-inside:avoid}

  @page{size:A4;margin:0}
  @media print{
    html,body{background:#fff}
    .page{display:block;min-height:0;overflow:visible;box-shadow:none}
    .footer-space{display:block;height:16mm}
    /* position:fixed repeats the footer at the bottom of EVERY page */
    .footer{
      position:fixed;left:0;right:0;bottom:0;
      height:14mm;padding-top:0;padding-bottom:0;margin:0;
      z-index:3;
    }
    .deco-bl{position:fixed;bottom:0;left:0}
  }
</style>
</head>
<body>
<div class="page">

  <!-- TOP-RIGHT BLUE DECO SHAPE -->
  <div class="deco-tr">
    <svg width="130" height="130" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
      <polygon points="130,0 130,130 0,0" fill="${accent}" opacity="0.12"/>
      <polygon points="130,0 130,90 40,0" fill="${accent}" opacity="0.20"/>
      <polygon points="130,0 130,50 80,0" fill="${accent}" opacity="0.35"/>
    </svg>
  </div>

  <!-- BOTTOM-LEFT BLUE DECO SHAPE -->
  <div class="deco-bl">
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,100 100,100 0,0" fill="${accent}" opacity="0.10"/>
      <polygon points="0,100 70,100 0,30" fill="${accent}" opacity="0.15"/>
    </svg>
  </div>

  <table class="layout"><tbody><tr><td>

  <!-- HEADER -->
  <div class="header">
    <img
      class="logo-img"
      src="${COMPANY.logo}"
      alt="Livedigit"
      onerror="this.style.display='none';document.getElementById('logo-fb').style.display='flex'"
    />
    <div id="logo-fb" class="logo-fallback">
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="${accent}18"/>
        <rect x="5" y="12" width="4" height="16" rx="2" fill="#e91e8c"/>
        <rect x="11" y="7" width="4" height="26" rx="2" fill="#e91e8c"/>
        <polygon points="19,7 37,20 19,33" fill="${accent}"/>
      </svg>
      <div>
        <div class="brand">Livedigit</div>
        <div class="tag">${COMPANY.tagline}</div>
      </div>
    </div>
  </div>

  <!-- TITLE -->
  <div class="title-section">
    <h1>${title}</h1>
  </div>
  <div class="title-rule"></div>

  <!-- DATE -->
  <div class="date-line">Date. ${date}</div>

  <!-- BODY -->
  <div class="letter-body">
    ${bodyHTML}
  </div>

  <!-- SIGNATURE -->
  <div class="sig-section">
    <div class="sig-rule"></div>
    <div class="sig-row">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">Authorised Signatory</div>
        <div class="sig-role">HR Department · ${COMPANY.name}</div>
      </div>
      <div class="sig-block" style="text-align:right">
        <div class="sig-line" style="margin-left:auto"></div>
        <div class="sig-name">Employee Acknowledgement</div>
        <div class="sig-role">Signature &amp; Date</div>
      </div>
    </div>
  </div>

  </td></tr></tbody>
  <tfoot><tr><td><div class="footer-space"></div></td></tr></tfoot>
  </table>

  <!-- FOOTER (fixed to the bottom of every printed page) -->
  <div class="footer">
    <div class="fc-item">
      <div class="fc-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      </div>
      ${COMPANY.email}
    </div>
    <div class="fc-item">
      <div class="fc-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      ${COMPANY.location}
    </div>
  </div>

</div>
</body>
</html>`
}

// ─── Download helper ──────────────────────────────────────────────────────────
const downloadLetterAsPDF = (letter) => {
  const html = buildLetterHTML(letter)
  const win  = window.open("", "_blank", "width=900,height=750")
  if (!win) { alert("Please allow popups to download the letter."); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 900)
}

// ─── Letter modal ─────────────────────────────────────────────────────────────
const LetterModal = ({ letter, onClose, allowDownload = false }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])
  const tpl = TEMPLATES.find((t) => t.key === letter.templateType)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{tpl?.label ?? letter.templateType}</p>
            <h2 className="text-sm font-semibold text-slate-100">{letter.subject}</h2>
            <p className="text-xs text-slate-500 mt-1">{fmtDate(letter.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {allowDownload && (
              <button onClick={() => downloadLetterAsPDF(letter)}
                className="flex items-center gap-1.5 text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                <DownloadIcon className="w-3.5 h-3.5" /> Download
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="px-6 py-5">
          <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{letter.renderedBody}</pre>
        </div>
      </div>
    </div>
  )
}

// ─── Reusable Dropdown ────────────────────────────────────────────────────────
const Dropdown = ({ value, onChange, options, placeholder, renderOption, renderSelected }) => {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-left transition-all text-sm ${
          selected ? "bg-slate-800 border-slate-600 text-slate-200" : "bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-500"
        }`}>
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selected ? renderSelected(selected) : placeholder}
        </span>
        <ChevronDownIcon className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {options.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors ${value === opt.value ? "bg-slate-800/70" : ""}`}>
                {renderOption(opt, value === opt.value)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Admin View ───────────────────────────────────────────────────────────────
const AdminLetters = () => {
  const [employees,  setEmployees]  = useState([])
  const [letters,    setLetters]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [sending,    setSending]    = useState(false)
  const [deleting,   setDeleting]   = useState(null)
  const [viewLetter, setViewLetter] = useState(null)
  const [template,   setTemplate]   = useState("")
  const [recipient,  setRecipient]  = useState("")
  const [customText, setCustomText] = useState("")

  const selectedEmp = employees.find(e => e._id === recipient)
  const selectedTpl = TEMPLATES.find(t => t.key === template)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, letRes] = await Promise.all([api.get("/employees"), api.get("/letters/all")])
      setEmployees(empRes.data.data || empRes.data || [])
      setLetters(letRes.data.data || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSend = async () => {
    if (!template || !recipient || !customText.trim()) return
    setSending(true)
    try {
      await api.post("/letters", { templateType: template, customText: customText.trim(), recipientEmployeeId: recipient })
      setTemplate(""); setRecipient(""); setCustomText("")
      await fetchAll()
    } catch (err) { alert(err?.response?.data?.error || "Failed to send letter") }
    finally { setSending(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm("Delete this letter?")) return
    setDeleting(id)
    try {
      await api.delete(`/letters/${id}`)
      setLetters(prev => prev.filter(l => l._id !== id))
    } catch { alert("Failed to delete") }
    finally { setDeleting(null) }
  }

  const templateOptions = TEMPLATES.map(t => ({ value: t.key, label: t.label, desc: t.desc, icon: t.icon, color: t.color }))
  const employeeOptions = employees.map(e => ({
    value: e._id, label: `${e.firstName} ${e.lastName}`,
    sub: `${e.position || ""}${e.department ? " · " + e.department : ""}`,
    initials: `${e.firstName?.[0]||""}${e.lastName?.[0]||""}`,
  }))

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Letters</h1>
        <p className="page-subtitle">Compose and send official letters to employees</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 sm:p-6 flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <SendIcon className="w-4 h-4 text-indigo-400" /> Compose Letter
          </h2>

          <div>
            <p className="text-xs text-slate-400 mb-2">Letter Type</p>
            <Dropdown value={template} onChange={setTemplate} options={templateOptions} placeholder="Select letter type…"
              renderSelected={opt => {
                const Icon = opt.icon
                return (<><span className={`p-1 rounded-md border ${opt.color}`}><Icon className="w-3.5 h-3.5"/></span><span className="font-medium">{opt.label}</span></>)
              }}
              renderOption={(opt, active) => {
                const Icon = opt.icon
                return (
                  <div className="flex items-center gap-3">
                    <span className={`p-1.5 rounded-lg border shrink-0 ${opt.color}`}><Icon className="w-3.5 h-3.5"/></span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${active?"text-slate-100":"text-slate-300"}`}>{opt.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                    {active && <span className="ml-auto text-indigo-400 text-xs shrink-0">✓</span>}
                  </div>
                )
              }}
            />
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">Recipient</p>
            <Dropdown value={recipient} onChange={setRecipient} options={employeeOptions} placeholder="Choose employee…"
              renderSelected={opt => (
                <><span className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-indigo-400">{opt.initials}</span></span><span className="font-medium">{opt.label}</span></>
              )}
              renderOption={(opt, active) => (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-indigo-400">{opt.initials}</span>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${active?"text-slate-100":"text-slate-300"}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.sub}</p>
                  </div>
                  {active && <span className="ml-auto text-indigo-400 text-xs shrink-0">✓</span>}
                </div>
              )}
            />
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">Custom Message <span className="text-red-400">*</span></p>
            <textarea rows={5} value={customText} onChange={e => setCustomText(e.target.value)}
              placeholder="Write your personalised message. It will be inserted into the letter template…"
              className="w-full text-sm bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"/>
          </div>

          {selectedTpl && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Preview</p>
              <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans leading-relaxed line-clamp-6">
                {selectedTpl.preview(selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : undefined, customText || undefined)}
              </pre>
            </div>
          )}

          <button onClick={handleSend} disabled={!(template && recipient && customText.trim()) || sending}
            className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {sending ? <Loader2Icon className="w-4 h-4 animate-spin"/> : <SendIcon className="w-4 h-4"/>}
            {sending ? "Sending…" : "Send Letter"}
          </button>
        </div>

        <div className="card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <MailIcon className="w-4 h-4 text-indigo-400"/> Sent Letters
            </h2>
            <span className="text-xs text-slate-500">{letters.length} total</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2Icon className="w-4 h-4 animate-spin"/><span className="text-sm">Loading…</span>
            </div>
          ) : letters.length === 0 ? (
            <div className="text-center py-12">
              <MailIcon className="w-8 h-8 text-slate-600 mx-auto mb-2"/>
              <p className="text-slate-400 text-sm">No letters sent yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 overflow-y-auto flex-1">
              {letters.map(l => {
                const tpl = TEMPLATES.find(t => t.key === l.templateType)
                const emp = l.recipientEmployeeId
                return (
                  <div key={l._id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-800/20 transition-colors">
                    <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${tpl?.color ?? "bg-slate-700 border-slate-600 text-slate-400"}`}>
                      {tpl ? <tpl.icon className="w-3.5 h-3.5"/> : <FileTextIcon className="w-3.5 h-3.5"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{l.subject}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">To: {emp?.firstName} {emp?.lastName} · {fmtDate(l.createdAt)}</p>
                      <p className="text-[10px] mt-0.5">
                        {l.readAt ? <span className="text-green-400">✓ Read</span> : <span className="text-slate-500">Unread</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setViewLetter(l)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="View"><EyeIcon className="w-3.5 h-3.5"/></button>
                      <button onClick={() => downloadLetterAsPDF(l)} className="p-1.5 rounded-lg text-slate-400 hover:text-green-400 hover:bg-green-500/10 transition-colors" title="Download PDF"><DownloadIcon className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDelete(l._id)} disabled={deleting === l._id} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40" title="Delete">
                        {deleting === l._id ? <Loader2Icon className="w-3.5 h-3.5 animate-spin"/> : <Trash2Icon className="w-3.5 h-3.5"/>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {viewLetter && <LetterModal letter={viewLetter} onClose={() => setViewLetter(null)} allowDownload/>}
    </div>
  )
}

// ─── Employee Inbox ───────────────────────────────────────────────────────────
const EmployeeLetters = () => {
  const { user } = useAuth()
  const [letters, setLetters] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewLetter, setViewLetter] = useState(null)

  const fetchLetters = useCallback(async () => {
    setLoading(true)
    try { const res = await api.get("/letters"); setLetters(res.data.data || []) }
    catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLetters() }, [fetchLetters])

  const handleOpen = async (letter) => {
    setViewLetter(letter)
    if (!letter.readAt) {
      try {
        await api.patch(`/letters/${letter._id}/read`)
        setLetters(prev => prev.map(l => l._id === letter._id ? { ...l, readAt: new Date().toISOString() } : l))
      } catch { /* silent */ }
    }
  }

  const unread = letters.filter(l => !l.readAt).length

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          Letters
          {unread > 0 && <span className="text-sm px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold">{unread} new</span>}
        </h1>
        <p className="page-subtitle">Official letters sent to you by HR</p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><MailIcon className="w-4 h-4 text-indigo-400"/> Inbox</h2>
          <span className="text-xs text-slate-500">{letters.length} letter{letters.length !== 1 ? "s" : ""}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2Icon className="w-4 h-4 animate-spin"/><span className="text-sm">Loading…</span></div>
        ) : letters.length === 0 ? (
          <div className="text-center py-16">
            <MailIcon className="w-10 h-10 text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400 text-sm font-medium">No letters yet</p>
            <p className="text-slate-600 text-xs mt-1">Letters from HR will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {letters.map(l => {
              const tpl = TEMPLATES.find(t => t.key === l.templateType)
              const isNew = !l.readAt
              return (
                <div key={l._id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-800/30 transition-colors">
                  <div className="relative shrink-0 mt-1">
                    <div className={`p-2 rounded-xl border ${tpl?.color ?? "bg-slate-700 border-slate-600 text-slate-400"}`}>
                      {tpl ? <tpl.icon className="w-4 h-4"/> : <FileTextIcon className="w-4 h-4"/>}
                    </div>
                    {isNew && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-900"/>}
                  </div>
                  <button onClick={() => handleOpen(l)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${isNew ? "font-semibold text-slate-100" : "font-medium text-slate-300"}`}>{l.subject}</p>
                      <span className="text-[10px] text-slate-500 shrink-0">{fmtDate(l.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {tpl?.label ?? l.templateType}
                      {isNew && <span className="ml-2 text-[10px] text-indigo-400 font-semibold">NEW</span>}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{l.renderedBody?.split("\n").find(ln => ln.trim()) ?? ""}</p>
                  </button>
                  <div className="flex gap-1 shrink-0 mt-1">
                    <button onClick={() => handleOpen(l)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"><EyeIcon className="w-4 h-4"/></button>
                    <button onClick={() => downloadLetterAsPDF(l)} className="p-1.5 rounded-lg text-slate-400 hover:text-green-400 hover:bg-green-500/10 transition-colors"><DownloadIcon className="w-4 h-4"/></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {viewLetter && <LetterModal letter={viewLetter} onClose={() => setViewLetter(null)} allowDownload/>}
    </div>
  )
}

const Letters = () => {
  const { user } = useAuth()
  if (!user) return null
  return user.role === "ADMIN" ? <AdminLetters /> : <EmployeeLetters />
}

export default Letters