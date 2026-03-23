import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const investmentId = searchParams.get("investment_id")

  let query = supabase
    .from("pt_documents")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })

  if (investmentId) query = query.eq("investment_id", investmentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const name = formData.get("name") as string
  const doc_type = formData.get("doc_type") as string
  const investment_id = formData.get("investment_id") as string | null
  const tax_year = formData.get("tax_year") as string | null

  if (!file || !name || !doc_type) {
    return NextResponse.json({ error: "file, name, and doc_type are required" }, { status: 400 })
  }

  const storagePath = `${entityId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

  const { error: uploadError } = await supabase.storage
    .from("partnership-documents")
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data, error } = await supabase
    .from("pt_documents")
    .insert({
      entity_id: entityId,
      investment_id: investment_id || null,
      name: name.trim(),
      doc_type,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      tax_year: tax_year ? Number(tax_year) : null,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data }, { status: 201 })
}
