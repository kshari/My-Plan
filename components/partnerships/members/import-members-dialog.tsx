"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Download } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { MemberRole } from "@/lib/types/partnerships"

interface ParsedRow {
  display_name: string
  email: string
  role: MemberRole
  ownership_pct: string
  _error?: string
}

interface ImportMembersDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  entityId: string
}

const VALID_ROLES: MemberRole[] = ["admin", "member", "observer"]
const CSV_TEMPLATE = "full_name,email,role,ownership_pct\nJane Smith,jane@example.com,member,25\nJohn Doe,john@example.com,member,25\n"

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  // Detect header row
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim())
  const nameIdx = header.findIndex((h) => ["full_name", "name", "display_name"].includes(h))
  const emailIdx = header.findIndex((h) => h === "email")
  const roleIdx = header.findIndex((h) => h === "role")
  const pctIdx = header.findIndex((h) => ["ownership_pct", "ownership", "pct", "percentage"].includes(h))

  return lines.slice(1).map((line) => {
    // Respect quoted fields
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ""))
    const display_name = nameIdx >= 0 ? (cols[nameIdx] ?? "") : (cols[0] ?? "")
    const email = emailIdx >= 0 ? (cols[emailIdx] ?? "") : (cols[1] ?? "")
    const rawRole = roleIdx >= 0 ? (cols[roleIdx] ?? "").toLowerCase() : (cols[2] ?? "").toLowerCase()
    const role: MemberRole = VALID_ROLES.includes(rawRole as MemberRole) ? (rawRole as MemberRole) : "member"
    const ownership_pct = pctIdx >= 0 ? (cols[pctIdx] ?? "0") : (cols[3] ?? "0")

    let _error: string | undefined
    if (!display_name.trim()) _error = "Name is required"
    else if (ownership_pct && isNaN(Number(ownership_pct))) _error = "Ownership % must be a number"

    return { display_name, email, role, ownership_pct: ownership_pct || "0", _error }
  })
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "members-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportMembersDialog({ open, onOpenChange, entityId }: ImportMembersDialogProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [importCount, setImportCount] = useState(0)

  function handleClose() {
    setRows([])
    setFileName("")
    setDone(false)
    setImportCount(0)
    onOpenChange(false)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      setRows(parsed)
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-selected after edit
    e.target.value = ""
  }

  function updateRow(idx: number, field: keyof ParsedRow, value: string) {
    setRows((prev) => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      // Re-validate
      const r = updated[idx]
      if (!r.display_name.trim()) r._error = "Name is required"
      else if (r.ownership_pct && isNaN(Number(r.ownership_pct))) r._error = "Ownership % must be a number"
      else r._error = undefined
      return updated
    })
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleImport() {
    const valid = rows.filter((r) => !r._error && r.display_name.trim())
    if (valid.length === 0) {
      toast.error("No valid rows to import")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/members/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: valid.map((r) => ({
            display_name: r.display_name.trim(),
            email: r.email.trim() || null,
            role: r.role,
            ownership_pct: Number(r.ownership_pct) || 0,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Import failed")
      }
      const { imported, skipped } = await res.json()
      setImportCount(imported)
      if (skipped > 0) toast.info(`${skipped} row${skipped !== 1 ? "s" : ""} skipped (duplicate email)`)
      setDone(true)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setLoading(false)
    }
  }

  const errorCount = rows.filter((r) => !!r._error).length
  const validCount = rows.filter((r) => !r._error && r.display_name.trim()).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Members from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk-add placeholder members. You can edit rows before importing.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">{importCount} member{importCount !== 1 ? "s" : ""} imported</p>
              <p className="text-sm text-muted-foreground mt-1">
                They have been added as placeholder members and can be assigned ownership and capital calls immediately.
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Upload area */}
            {rows.length === 0 ? (
              <div className="flex flex-col gap-4">
                {/* Format guide */}
                <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected columns</p>
                  <code className="text-xs block font-mono">full_name, email, role, ownership_pct</code>
                  <ul className="text-xs text-muted-foreground space-y-1 mt-2 list-disc pl-4">
                    <li><strong>full_name</strong> — required; also accepted as <code>name</code> or <code>display_name</code></li>
                    <li><strong>email</strong> — optional; used to auto-link when they register</li>
                    <li><strong>role</strong> — <code>admin</code>, <code>member</code> (default), or <code>observer</code></li>
                    <li><strong>ownership_pct</strong> — numeric, defaults to 0</li>
                  </ul>
                </div>

                <div
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Click to upload a CSV file</p>
                    <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                </div>

                <Button variant="outline" size="sm" className="self-start gap-1.5" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" />
                  Download template
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-hidden">
                {/* File info + re-upload */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{fileName}</span>
                    <span className="text-muted-foreground">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
                    {errorCount > 0 && (
                      <Badge variant="destructive" className="text-xs">{errorCount} error{errorCount !== 1 ? "s" : ""}</Badge>
                    )}
                    {validCount > 0 && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{validCount} valid</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setRows([]); setFileName("") }}>
                    Change file
                  </Button>
                </div>

                <Separator />

                {/* Editable preview table */}
                <div className="overflow-auto rounded-lg border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Full Name *</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Role</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Ownership %</th>
                        <th className="px-3 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row, idx) => (
                        <tr key={idx} className={cn("hover:bg-muted/20", row._error && "bg-destructive/5")}>
                          <td className="px-2 py-1.5">
                            <div className="space-y-1">
                              <Input
                                value={row.display_name}
                                onChange={(e) => updateRow(idx, "display_name", e.target.value)}
                                className={cn("h-7 text-xs", row._error && "border-destructive")}
                              />
                              {row._error && (
                                <p className="text-destructive flex items-center gap-1 text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {row._error}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={row.email}
                              onChange={(e) => updateRow(idx, "email", e.target.value)}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Select
                              value={row.role}
                              onValueChange={(v) => updateRow(idx, "role", v)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="observer">Observer</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={row.ownership_pct}
                              onChange={(e) => updateRow(idx, "ownership_pct", e.target.value)}
                              className="h-7 text-xs text-right"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRow(idx)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer actions */}
            {rows.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-1 border-t">
                <p className="text-xs text-muted-foreground">
                  {errorCount > 0
                    ? `Fix ${errorCount} error${errorCount !== 1 ? "s" : ""} before importing, or they will be skipped.`
                    : `${validCount} member${validCount !== 1 ? "s" : ""} ready to import.`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>Cancel</Button>
                  <Button onClick={handleImport} disabled={loading || validCount === 0}>
                    {loading ? "Importing..." : `Import ${validCount} Member${validCount !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
