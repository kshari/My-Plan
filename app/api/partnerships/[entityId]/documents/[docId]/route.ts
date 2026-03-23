import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string; docId: string }>
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { entityId, docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: doc } = await supabase
    .from("pt_documents")
    .select("storage_path")
    .eq("id", docId)
    .eq("entity_id", entityId)
    .single()

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Delete from storage
  await supabase.storage.from("partnership-documents").remove([doc.storage_path])

  // Delete record
  const { error } = await supabase.from("pt_documents").delete().eq("id", docId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
