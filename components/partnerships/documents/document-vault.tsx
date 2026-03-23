"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  File,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { DOC_TYPES, DOC_TYPE_LABELS } from "@/lib/constants/partnerships"
import type { PartnershipDocument, DocType } from "@/lib/types/partnerships"

interface DocumentVaultProps {
  entityId: string
  documents: PartnershipDocument[]
  isAdmin: boolean
  investmentId?: string
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

const DOC_TYPE_ICONS: Record<DocType, React.ElementType> = {
  k1: FileText,
  operating_agreement: FileText,
  subscription_agreement: FileText,
  tax_return: FileText,
  receipt: File,
  contract: FileText,
  statement: FileText,
  other: File,
}

export function DocumentVault({ entityId, documents, isAdmin, investmentId }: DocumentVaultProps) {
  const router = useRouter()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: "",
    doc_type: "other" as DocType,
    tax_year: "",
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !form.name || !form.doc_type) {
      toast.error("Please select a file and fill required fields")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", selectedFile)
      fd.append("name", form.name)
      fd.append("doc_type", form.doc_type)
      if (investmentId) fd.append("investment_id", investmentId)
      if (form.tax_year) fd.append("tax_year", form.tax_year)

      const res = await fetch(`/api/partnerships/${entityId}/documents`, {
        method: "POST",
        body: fd,
      })
      if (!res.ok) throw new Error("Upload failed")
      toast.success("Document uploaded")
      setUploadOpen(false)
      setForm({ name: "", doc_type: "other", tax_year: "" })
      setSelectedFile(null)
      router.refresh()
    } catch {
      toast.error("Failed to upload document")
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc: PartnershipDocument) {
    try {
      const res = await fetch(`/api/partnerships/${entityId}/documents/${doc.id}/download`)
      if (!res.ok) throw new Error()
      const { url, name } = await res.json()
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.target = "_blank"
      a.click()
    } catch {
      toast.error("Failed to download document")
    }
  }

  async function handleDelete(docId: string) {
    try {
      const res = await fetch(`/api/partnerships/${entityId}/documents/${docId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Document deleted")
      router.refresh()
    } catch {
      toast.error("Failed to delete document")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{documents.length} documents</span>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="py-16 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents yet</p>
            {isAdmin && (
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload Document
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => {
              const Icon = DOC_TYPE_ICONS[doc.doc_type]
              return (
                <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_TYPE_LABELS[doc.doc_type]}
                      {doc.tax_year ? ` · ${doc.tax_year}` : ""}
                      {" · "}{formatFileSize(doc.file_size)}
                      {" · "}{new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(doc)}
                      className="h-8 w-8"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete document?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{doc.name}&quot;. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(doc.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="file">File *</Label>
              <input
                id="file"
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setSelectedFile(f)
                  if (f && !form.name) setForm((prev) => ({ ...prev, name: f.name }))
                }}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:text-sm file:font-medium file:bg-background hover:file:bg-accent cursor-pointer"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc_name">Document Name *</Label>
              <Input
                id="doc_name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v as DocType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(form.doc_type === "k1" || form.doc_type === "tax_return") && (
                <div className="space-y-2">
                  <Label htmlFor="tax_year">Tax Year</Label>
                  <Input
                    id="tax_year"
                    type="number"
                    min={2000}
                    max={2100}
                    placeholder={String(new Date().getFullYear() - 1)}
                    value={form.tax_year}
                    onChange={(e) => setForm({ ...form, tax_year: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={uploading || !selectedFile} className="flex-1">
                {uploading ? "Uploading..." : "Upload"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
