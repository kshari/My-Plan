"use client"
import { useParams } from "next/navigation"
import { JournalEntryForm } from "@/components/partnerships/accounting/journal-entry-form"
export default function NewJournalEntryPage() {
  const { entityId } = useParams<{ entityId: string }>()
  return <JournalEntryForm entityId={entityId} />
}
