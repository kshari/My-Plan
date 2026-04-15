"use client"
import { useParams } from "next/navigation"
import { JournalEntryForm } from "@/components/partnerships/accounting/journal-entry-form"
export default function JournalEntryDetailPage() {
  const { entityId, entryId } = useParams<{ entityId: string; entryId: string }>()
  return <JournalEntryForm entityId={entityId} entryId={entryId} />
}
