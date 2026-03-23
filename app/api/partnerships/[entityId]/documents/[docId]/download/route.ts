import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string; docId: string }>
}

// GET signed download URL
export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId, docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: doc } = await supabase
    .from("pt_documents")
    .select("storage_path, name")
    .eq("id", docId)
    .eq("entity_id", entityId)
    .single()

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: signedData, error } = await supabase.storage
    .from("partnership-documents")
    .createSignedUrl(doc.storage_path, 300) // 5 minute expiry

  if (error || !signedData) {
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 })
  }

  return NextResponse.json({ url: signedData.signedUrl, name: doc.name })
}
