"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  LayoutDashboard, TrendingUp, BookOpen, Users, Vote, FolderOpen, Settings,
  Calculator, FileText, Scale, BarChart3, Droplets, PieChart, ClipboardList,
  Receipt, ChevronRight, Search, ArrowUp,
} from "lucide-react"

// ─── Guide content data ───────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "getting-started",
    icon: LayoutDashboard,
    title: "Getting Started",
    color: "blue",
    content: [
      {
        heading: "What is the Partnerships App?",
        body: `The Partnerships app is a collaborative platform for managing investment partnerships, LLCs, limited partnerships, trusts, and other multi-party investment structures. Each "entity" is an isolated workspace — members, investments, decisions, documents, and accounting all live within a single entity.`,
      },
      {
        heading: "Creating your first entity",
        steps: [
          `Click the + button next to "My Entities" in the sidebar.`,
          "Enter the entity name, type (LLC, LP, Corporation, etc.), state of formation, and EIN if available.",
          "You are automatically added as an Admin member.",
          "A default Chart of Accounts and current fiscal year are created automatically in the Accounting module.",
        ],
      },
      {
        heading: "Roles & permissions",
        table: {
          headers: ["Role", "Can View", "Can Edit", "Can Manage Members", "Can Access Accounting"],
          rows: [
            ["Admin", "✓", "✓", "✓", "✓"],
            ["Member", "✓", "Limited", "✗", "Read-only K-1s"],
            ["Observer", "✓", "✗", "✗", "✗"],
          ],
        },
      },
    ],
  },
  {
    id: "overview",
    icon: LayoutDashboard,
    title: "Overview Dashboard",
    color: "blue",
    content: [
      {
        heading: "What it shows",
        body: "The entity Overview is the command center for a single partnership. It gives you a real-time snapshot of the entity's health across all dimensions.",
      },
      {
        heading: "Key widgets",
        bullets: [
          "Total Capital — sum of all member contributions tracked as capital events.",
          "Active Investments — count of investments not in cancelled or exited status.",
          "Members — how many active members the entity has and their aggregate ownership.",
          "Open Decisions — outstanding votes that need attention.",
          "Capital Events timeline — a history of contributions and distributions.",
        ],
      },
      {
        heading: "Tips",
        bullets: [
          "The Overview pulls live data — no need to refresh manually.",
          "Click any widget to navigate directly to the relevant section.",
          "Admins see more data than observers.",
        ],
      },
    ],
  },
  {
    id: "investments",
    icon: TrendingUp,
    title: "Investments",
    color: "green",
    content: [
      {
        heading: "What it's for",
        body: "Track every investment the partnership has made or is evaluating. Investments move through a configurable workflow from ideation through exit, so everyone always knows where a deal stands.",
      },
      {
        heading: "Investment workflow stages",
        table: {
          headers: ["Stage", "Meaning"],
          rows: [
            ["Ideation", "Idea under preliminary review — no capital committed."],
            ["Due Diligence", "Active research and document gathering."],
            ["Term Sheet", "Offer or term sheet issued/received."],
            ["Committed", "Legally committed but not yet closed."],
            ["Active", "Investment is live; capital has been deployed."],
            ["Monitoring", "Post-investment ongoing tracking."],
            ["Exited", "Position fully or partially liquidated."],
          ],
        },
      },
      {
        heading: "Adding an investment",
        steps: [
          `Click "+ New Investment" in the Investments page.`,
          "Fill in the name, type (equity, debt, real estate, fund, etc.), target amount, and expected return.",
          "Set the current workflow stage.",
          "Optionally attach documents and link decisions to the investment.",
        ],
      },
      {
        heading: "Investment detail page",
        bullets: [
          "Edit — update any field at any time. Stage transitions are tracked with timestamps.",
          "Ledger — view all financial transactions tied to this specific investment.",
          "Documents — investment-specific document vault separate from the entity vault.",
          "Decisions — governance votes that pertain specifically to this investment.",
        ],
      },
    ],
  },
  {
    id: "ledger",
    icon: BookOpen,
    title: "Ledger",
    color: "yellow",
    content: [
      {
        heading: "What it's for",
        body: "The Ledger is a simple cash-basis record of all financial transactions for the entity — contributions, distributions, management fees, expenses, and any other cash movements. It is separate from the double-entry Accounting module (which is forward-only), making it useful for quick entry and historical records.",
      },
      {
        heading: "Transaction types",
        table: {
          headers: ["Type", "Description"],
          rows: [
            ["Contribution", "Member puts money into the entity."],
            ["Distribution", "Entity sends money to a member."],
            ["Capital Call", "Formal request for members to contribute per the call schedule."],
            ["Management Fee", "Fee charged to the entity for management services."],
            ["Expense", "General operating cost (legal, admin, etc.)."],
            ["Income", "Revenue received by the entity."],
            ["Other", "Any transaction that doesn't fit the above."],
          ],
        },
      },
      {
        heading: "Tips",
        bullets: [
          "Filter by type or date range to find specific transactions quickly.",
          "Transactions can be linked to a specific investment for deal-level tracking.",
          "The Ledger feeds into the Cap Table — contributions and distributions update each partner's capital balance.",
          "For full double-entry accounting (balance sheet, P&L), use the Accounting module instead.",
        ],
      },
    ],
  },
  {
    id: "cap-table",
    icon: Users,
    title: "Cap Table",
    color: "purple",
    content: [
      {
        heading: "What it's for",
        body: "The Cap Table shows each partner's ownership percentage, total capital contributed, and total distributions received. It is the authoritative record of who owns what.",
      },
      {
        heading: "How it works",
        bullets: [
          "When a member is added with an ownership %, their cap table entry is auto-created.",
          "Contributions and distributions posted in the Ledger update each member's capital contributed / distributions received columns.",
          "Effective date tracking lets you see the cap table as of any historical date.",
        ],
      },
      {
        heading: "Making adjustments",
        steps: [
          "Navigate to Cap Table.",
          `Click "Add Entry" to record an ownership change or manual adjustment.`,
          "Set the effective date — all future snapshots will reflect the new ownership from that date forward.",
          "Reason field is required for audit purposes.",
        ],
      },
      {
        heading: "Pro tips",
        bullets: [
          "Ownership percentages in the cap table drive K-1 allocation in the Accounting module.",
          "All entries are immutable after posting — corrections must be added as new entries.",
        ],
      },
    ],
  },
  {
    id: "decisions",
    icon: Vote,
    title: "Decisions & Voting",
    color: "indigo",
    content: [
      {
        heading: "What it's for",
        body: "The Decisions module provides a formal governance layer — any action requiring partner approval (new investments, distributions, bylaw changes) should go through a Decision. Votes are timestamped and immutable, creating a permanent governance record.",
      },
      {
        heading: "Decision types",
        bullets: [
          "Investment Approval — vote to proceed with a new investment.",
          "Distribution — vote to authorize a cash distribution.",
          "Member Change — vote to admit a new partner or change ownership.",
          "Policy Update — changes to operating agreements or internal policies.",
          "Other — any governance matter not covered above.",
        ],
      },
      {
        heading: "Voting methods",
        table: {
          headers: ["Method", "How it works"],
          rows: [
            ["Simple Majority", "More than 50% of votes cast."],
            ["Supermajority", "Two-thirds (66.7%) of votes cast."],
            ["Unanimous", "All members must vote yes."],
            ["Weighted", "Votes are weighted by ownership percentage."],
          ],
        },
      },
      {
        heading: "Lifecycle of a decision",
        steps: [
          `Admin creates a decision with title, type, voting method, and quorum.`,
          "Decision is opened — members receive notification and can vote.",
          "Comments can be added for discussion.",
          "Once quorum is reached or deadline passes, the decision is resolved (approved/rejected).",
          "Resolved decisions are permanently archived with the full vote record.",
        ],
      },
    ],
  },
  {
    id: "documents",
    icon: FolderOpen,
    title: "Documents",
    color: "orange",
    content: [
      {
        heading: "What it's for",
        body: "The Document Vault is a secure repository for all partnership-related files — operating agreements, tax filings, investment memos, legal correspondence, and K-1s. Files are stored per-entity (or per-investment) and access is controlled by role.",
      },
      {
        heading: "Document types",
        bullets: [
          "Operating Agreement — foundational governance document.",
          "Tax Filing — federal and state returns, K-1 packages.",
          "Investment Memo — diligence materials for a specific deal.",
          "Legal — contracts, amendments, resolutions.",
          "Financial — statements, audits, valuations.",
          "Other — anything that doesn't fit another category.",
        ],
      },
      {
        heading: "Uploading a document",
        steps: [
          `Click "Upload Document".`,
          "Select the file (PDF, Excel, Word, images supported).",
          "Choose the document type and optionally link it to an investment.",
          "Set the tax year if it's a tax document.",
          "The file is stored securely and versioned.",
        ],
      },
      {
        heading: "Tips",
        bullets: [
          "Investment-level documents are also accessible from the Investment detail page.",
          "Observers can view documents but cannot upload.",
          "Files are accessible via signed URLs that expire — share links do not persist.",
        ],
      },
    ],
  },
  {
    id: "members",
    icon: Users,
    title: "Members",
    color: "teal",
    content: [
      {
        heading: "What it's for",
        body: "Manage who has access to the entity, their role, ownership percentage, and contact information. Only admins can add, edit, or remove members.",
      },
      {
        heading: "Adding members",
        table: {
          headers: ["Method", "When to use"],
          rows: [
            ["Add Directly", "Add a placeholder member without an account (e.g., a silent partner who doesn't need app access)."],
            ["Invite by Email", "Send an invitation link — the invitee creates an account and joins automatically."],
            ["Import (CSV)", "Bulk-add multiple members at once with name, email, role, and ownership %."],
          ],
        },
      },
      {
        heading: "What happens when a member is added",
        bullets: [
          "A cap table entry is automatically created for their ownership %.",
          "A personal Partner Capital Account (e.g., account 3001) is auto-created in the Chart of Accounts.",
          "They receive access to the entity per their assigned role.",
        ],
      },
      {
        heading: "Removing a member",
        body: `Use the "Remove" action on a member. This sets their status to "removed" and strips app access, but all historical records (transactions, votes, capital events) are preserved for audit and tax purposes.`,
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Entity Settings",
    color: "gray",
    content: [
      {
        heading: "What you can configure",
        bullets: [
          "Entity name, type, and description.",
          "State of formation and EIN.",
          "Fiscal year end (default: 12/31).",
          "Entity status — Active, Forming, or Dissolved.",
        ],
      },
      {
        heading: "Important notes",
        bullets: [
          "Changing the fiscal year end affects how the Accounting module assigns journal entries to fiscal years.",
          "Setting status to Dissolved does not delete any data — it flags the entity as inactive.",
          "Only admins can change entity settings.",
        ],
      },
    ],
  },
  {
    id: "accounting",
    icon: Calculator,
    title: "Accounting Module",
    color: "blue",
    isAccounting: true,
    content: [
      {
        heading: "Overview",
        body: `The Accounting module is a full double-entry bookkeeping system built into the partnerships app. It runs "forward-only" — it doesn't modify or replace your existing Ledger entries. Think of it as a proper general ledger where every dollar has a source and a destination.`,
      },
      {
        heading: "Core concepts",
        table: {
          headers: ["Concept", "What it means"],
          rows: [
            ["Double-entry", "Every transaction has at least one debit and one credit that must balance."],
            ["Debit", "Left side of an entry. Increases assets and expenses. Decreases liabilities, equity, and income."],
            ["Credit", "Right side of an entry. Increases liabilities, equity, and income. Decreases assets and expenses."],
            ["Posted", "A journal entry that has been finalized and is immutable. Void to correct."],
            ["Draft", "A saved but unposted entry — can be edited or deleted."],
            ["Fiscal Year", "The accounting period (usually Jan 1 – Dec 31). All reports are scoped to a fiscal year."],
          ],
        },
      },
    ],
  },
  {
    id: "chart-of-accounts",
    icon: ClipboardList,
    title: "Chart of Accounts",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it's for",
        body: "The Chart of Accounts (COA) is the master list of every financial category used in your journal entries. It is automatically created with ~28 standard accounts when you create an entity.",
      },
      {
        heading: "Account types",
        table: {
          headers: ["Type", "Normal Balance", "Examples"],
          rows: [
            ["Asset", "Debit", "Cash (1000), Investments (1200), Fixed Assets (1500)"],
            ["Liability", "Credit", "Accounts Payable (2000), Notes Payable (2100)"],
            ["Equity", "Credit", "Partners' Capital (3000), individual capital accounts (3001, 3002…)"],
            ["Income", "Credit", "Investment Income (4000), Capital Gains (4300)"],
            ["Expense", "Debit", "Management Fees (5000), Legal & Professional (5100)"],
          ],
        },
      },
      {
        heading: "Managing accounts",
        bullets: [
          "System accounts (created automatically) cannot be deleted — deactivate them if not needed.",
          "You can add custom accounts with any code and sub-account hierarchy.",
          "Per-partner capital accounts (3001, 3002…) are auto-created when members are added.",
          "Deactivated accounts still appear on historical reports but cannot receive new journal lines.",
        ],
      },
    ],
  },
  {
    id: "journal-entries",
    icon: FileText,
    title: "Journal Entries",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it's for",
        body: "Journal entries are the atomic unit of accounting — every financial event is recorded as a journal entry with debit and credit lines. The system validates that entries balance before posting.",
      },
      {
        heading: "Creating a journal entry",
        steps: [
          `Click "+ New Entry" on the Journal Entries page.`,
          "Set the date, description, and fiscal year.",
          "Add debit and credit lines — enter an amount in either the Debit or Credit column (not both) for each line.",
          `The running total at the bottom shows debits and credits. A green "Balanced" indicator appears when they match.`,
          `Click "Save as Draft" to save without posting, or "Post Entry" to finalize.`,
        ],
      },
      {
        heading: "Common entry examples",
        table: {
          headers: ["Transaction", "Debit", "Credit"],
          rows: [
            ["Receive cash contribution from partner", "1000 Cash", "3001 Partner Capital Account"],
            ["Pay management fee expense", "5000 Management Fees", "1000 Cash"],
            ["Record investment income", "1000 Cash", "4000 Investment Income"],
            ["Pay distribution to partner", "3001 Partner Capital Account", "1000 Cash"],
            ["Record loan received", "1000 Cash", "2100 Notes Payable"],
          ],
        },
      },
      {
        heading: "Voiding entries",
        body: "Posted entries cannot be edited. To correct a posted entry, use the Void action — this marks it as voided and you can create a new correcting entry. Voided entries remain visible for audit trail purposes.",
      },
    ],
  },
  {
    id: "balance-sheet",
    icon: Scale,
    title: "Balance Sheet",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it shows",
        body: "The Balance Sheet shows the entity's financial position at a specific point in time. It is based on the fundamental accounting equation: Assets = Liabilities + Equity.",
      },
      {
        heading: "Sections",
        bullets: [
          "Assets — what the entity owns (cash, investments, property, receivables).",
          "Liabilities — what the entity owes (loans, accounts payable, accrued expenses).",
          "Equity — the partners' residual interest (partners' capital accounts, retained earnings).",
        ],
      },
      {
        heading: "Using it",
        steps: [
          `Choose the "As of" date using the date picker.`,
          `Click "Refresh" to recompute.`,
          "If the sheet is unbalanced (Assets ≠ Liabilities + Equity), an alert is shown — this usually means a journal entry is missing a side.",
        ],
      },
    ],
  },
  {
    id: "income-statement",
    icon: BarChart3,
    title: "Income Statement (P&L)",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it shows",
        body: "The Income Statement (also called Profit & Loss or P&L) shows all revenue earned and expenses incurred over a period. Net Income = Revenue − Expenses.",
      },
      {
        heading: "Key lines",
        bullets: [
          "Revenue — all income accounts (investment income, interest, dividends, capital gains, management fees received).",
          "Expenses — all expense accounts (management fees paid, legal, admin, interest expense).",
          "Net Income — the bottom line, allocated to partners via K-1 based on ownership %.",
        ],
      },
      {
        heading: "Using it",
        body: "Set the start and end dates. For a full-year P&L, use January 1 to December 31 of the fiscal year. Net income flows into the Partners' Capital Statement and K-1 allocations.",
      },
    ],
  },
  {
    id: "cash-flows",
    icon: Droplets,
    title: "Statement of Cash Flows",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it shows",
        body: "The Cash Flow Statement reconciles net income to actual cash movement. It uses the indirect method, starting with net income and adjusting for non-cash items and working capital changes.",
      },
      {
        heading: "Three sections",
        table: {
          headers: ["Section", "What's included"],
          rows: [
            ["Operating Activities", "Net income, depreciation, changes in receivables, payables, accruals."],
            ["Investing Activities", "Purchases and sales of investments, fixed assets."],
            ["Financing Activities", "Partner contributions, distributions, loan proceeds, loan repayments."],
          ],
        },
      },
      {
        heading: "Reading it",
        body: "Ending Cash Balance = Beginning Cash Balance + Net Change. This should match the Cash account balance on the Balance Sheet. Discrepancies indicate mis-categorized accounts.",
      },
    ],
  },
  {
    id: "partners-capital",
    icon: PieChart,
    title: "Partners' Capital Statement",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it shows",
        body: "This statement reconciles each partner's capital account from the beginning of the year to the end: Beginning Capital + Contributions + Allocated Net Income − Distributions = Ending Capital.",
      },
      {
        heading: "How allocation works",
        bullets: [
          "Net income is allocated to each partner pro-rata based on their ownership % in the cap table.",
          "Contributions are credits to the partner's capital account (account 3001, 3002, etc.).",
          "Distributions are debits from the partner's capital account.",
          "Ending capital per this statement equals each partner's capital account balance on the Balance Sheet.",
        ],
      },
      {
        heading: "Connection to K-1",
        body: "The Partners' Capital Statement is the foundation for Schedule K-1 — the capital account analysis section of the K-1 (Part II) comes directly from this report.",
      },
    ],
  },
  {
    id: "trial-balance",
    icon: Receipt,
    title: "Trial Balance",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it's for",
        body: "The Trial Balance lists every account with its total debits and credits. It verifies that the accounting equation holds — total debits must equal total credits across all posted entries.",
      },
      {
        heading: "Using it",
        bullets: [
          `Toggle "Hide zero-balance" to focus on accounts with activity.`,
          "If totals are unbalanced, review recent journal entries for data entry errors.",
          "Accountants use the trial balance as a starting point for preparing financial statements.",
          "Run the trial balance before generating K-1s to ensure data integrity.",
        ],
      },
    ],
  },
  {
    id: "k1s",
    icon: FolderOpen,
    title: "Schedule K-1",
    color: "blue",
    parent: "accounting",
    content: [
      {
        heading: "What it's for",
        body: "Schedule K-1 (Form 1065) reports each partner's share of the partnership's income, deductions, credits, and other items for the tax year. Partners use K-1s to complete their individual tax returns. The app generates all boxes of the full IRS K-1.",
      },
      {
        heading: "K-1 workflow",
        steps: [
          "Ensure all journal entries for the fiscal year are posted.",
          `Navigate to Schedule K-1 and select the fiscal year.`,
          `Click "Generate / Refresh K-1s" — the system allocates income, expenses, contributions, and distributions to each partner based on their ownership %.`,
          "Review each partner's K-1 detail — manually adjust any box that requires override (e.g., guaranteed payments, Section 1231 gain, AMT items).",
          `When all boxes are correct, click "Finalize K-1" — finalized K-1s are locked and cannot be edited.`,
          `Use "Print / Export PDF" to produce a print-ready copy for each partner.`,
        ],
      },
      {
        heading: "Key K-1 boxes",
        table: {
          headers: ["Box", "What it means"],
          rows: [
            ["Box 1", "Ordinary business income (loss) — partner's share of operating income."],
            ["Box 9a", "Net long-term capital gain — partner's share of LT capital gains."],
            ["Box 4/5", "Guaranteed payments — special income paid to a partner regardless of profitability."],
            ["Box 13", "Other deductions — Section 179, charitable contributions, etc."],
            ["Box 19a", "Cash distributions — total cash paid to the partner during the year."],
            ["Part II", "Capital account analysis — beginning, contributions, allocated income, distributions, ending."],
          ],
        },
      },
      {
        heading: "Important notes",
        bullets: [
          "K-1s are generated from posted journal entries only — drafts are excluded.",
          "Run the Trial Balance and Partners' Capital Statement before generating K-1s to verify data.",
          "The Capital Account method defaults to 'Tax Basis' — change per partner if your partnership uses GAAP or Section 704 basis.",
          "Mid-year ownership changes are handled automatically via time-weighted average ownership.",
          "Consult your tax advisor before distributing K-1s to partners.",
        ],
      },
    ],
  },
]

// ─── Color utilities ──────────────────────────────────────────────────────────

const COLORS: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", badge: "bg-blue-100 text-blue-800" },
  green: { bg: "bg-green-50", border: "border-green-200", icon: "text-green-600", badge: "bg-green-100 text-green-800" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-200", icon: "text-yellow-700", badge: "bg-yellow-100 text-yellow-800" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-600", badge: "bg-purple-100 text-purple-800" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-600", badge: "bg-indigo-100 text-indigo-800" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-600", badge: "bg-orange-100 text-orange-800" },
  teal: { bg: "bg-teal-50", border: "border-teal-200", icon: "text-teal-600", badge: "bg-teal-100 text-teal-800" },
  gray: { bg: "bg-gray-50", border: "border-gray-200", icon: "text-gray-600", badge: "bg-gray-100 text-gray-700" },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartnershipGuidePage() {
  const [search, setSearch] = useState("")
  const [activeSection, setActiveSection] = useState("")
  const [showScrollTop, setShowScrollTop] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Track scroll for active TOC item + back-to-top
  useEffect(() => {
    function onScroll() {
      const scrollY = window.scrollY
      setShowScrollTop(scrollY > 400)

      // Find which section is in view
      for (const section of [...SECTIONS].reverse()) {
        const el = document.getElementById(section.id)
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(section.id)
          return
        }
      }
      setActiveSection("")
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const filteredSections = search
    ? SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.content.some(c =>
          c.heading?.toLowerCase().includes(search.toLowerCase()) ||
          (c as any).body?.toLowerCase().includes(search.toLowerCase()) ||
          (c as any).bullets?.some((b: string) => b.toLowerCase().includes(search.toLowerCase()))
        )
      )
    : SECTIONS

  const topLevelSections = SECTIONS.filter(s => !s.parent)
  const accountingSubSections = SECTIONS.filter(s => s.parent === "accounting")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Partnerships User Guide</h1>
            <p className="text-sm text-gray-500">How to manage your partnership and accounting data</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
              placeholder="Search the guide…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar TOC — hidden on mobile */}
        {!search && (
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-2">Contents</p>
              {topLevelSections.map(section => {
                const C = COLORS[section.color] ?? COLORS.gray
                const isActive = activeSection === section.id
                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${isActive ? `${C.bg} ${C.icon} font-semibold` : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                  >
                    <section.icon className="h-3.5 w-3.5 shrink-0" />
                    {section.title}
                  </a>
                )
              })}
              <div className="pl-4 space-y-0.5 mt-1 border-l-2 border-gray-200">
                {accountingSubSections.map(section => {
                  const isActive = activeSection === section.id
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors ${isActive ? "text-blue-700 font-semibold bg-blue-50" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`}
                    >
                      <section.icon className="h-3 w-3 shrink-0" />
                      {section.title}
                    </a>
                  )
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main ref={contentRef} className="flex-1 min-w-0 space-y-10">
          {filteredSections.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>No results for "{search}"</p>
              <button onClick={() => setSearch("")} className="text-sm text-blue-600 hover:underline mt-2">Clear search</button>
            </div>
          )}

          {filteredSections.map(section => {
            const C = COLORS[section.color] ?? COLORS.gray
            const Icon = section.icon
            return (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                {/* Section header */}
                {section.parent === "accounting" ? (
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${C.bg} ${C.border} border`}>
                      <Icon className={`h-4 w-4 ${C.icon}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Accounting →</p>
                      <h2 className="text-base font-bold text-gray-900 leading-tight">{section.title}</h2>
                    </div>
                  </div>
                ) : (
                  <div className={`flex items-center gap-4 p-4 rounded-xl ${C.bg} ${C.border} border mb-5`}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border ${C.border} shrink-0`}>
                      <Icon className={`h-5 w-5 ${C.icon}`} />
                    </div>
                    <div>
                      {section.isAccounting && (
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${C.badge} mr-2`}>Module</span>
                      )}
                      <h2 className="text-lg font-bold text-gray-900 inline">{section.title}</h2>
                    </div>
                  </div>
                )}

                {/* Section content */}
                <div className="space-y-6 pl-0 lg:pl-2">
                  {section.content.map((block, i) => (
                    <div key={i}>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">{block.heading}</h3>
                      {"body" in block && block.body && (
                        <p className="text-sm text-gray-600 leading-relaxed">{block.body}</p>
                      )}
                      {"bullets" in block && block.bullets && (
                        <ul className="space-y-1.5">
                          {block.bullets.map((b: string, j: number) => (
                            <li key={j} className="flex gap-2 text-sm text-gray-600">
                              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {"steps" in block && block.steps && (
                        <ol className="space-y-2">
                          {block.steps.map((step: string, j: number) => (
                            <li key={j} className="flex gap-3 text-sm text-gray-600">
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold shrink-0 mt-0.5 ${C.bg} ${C.icon} border ${C.border}`}>
                                {j + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {"table" in block && block.table && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                {block.table.headers.map((h: string, j: number) => (
                                  <th key={j} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {block.table.rows.map((row: string[], j: number) => (
                                <tr key={j} className="hover:bg-gray-50">
                                  {row.map((cell, k) => (
                                    <td key={k} className={`px-3 py-2 text-gray-700 ${k === 0 ? "font-medium" : ""}`}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Divider between sections */}
                <div className="mt-8 border-b border-gray-200" />
              </section>
            )
          })}
        </main>
      </div>

      {/* Back to top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 h-10 w-10 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 z-20 transition-opacity"
          title="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
