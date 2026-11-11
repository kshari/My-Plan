import { createClient } from '@/lib/supabase/server'
import { safeJson } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'
import {
  DEAL_STAGES,
  STAGE_CHECKLIST_TEMPLATES,
} from '@/lib/constants/property-defaults'
import type { DealStage } from '@/lib/types/property-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/property/deals/[id]/stage
// Advances the deal to the requested stage.  If jumping forward by more than
// one step, inserts completed-stage history entries for every skipped stage
// (mirrors the partnerships stage route).  On entry seeds the checklist tasks
// template for the target stage.
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { stage, notes } = body as { stage: string; notes?: string }

  if (!stage || !DEAL_STAGES.includes(stage as DealStage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) return NextResponse.json({ error: 'Invalid property id' }, { status: 400 })

  // Fetch current stage, verifying ownership
  const { data: property, error: fetchError } = await supabase
    .from('pi_properties')
    .select('id, deal_stage')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  const fromIndex = DEAL_STAGES.indexOf((property.deal_stage ?? 'lead') as DealStage)
  const toIndex   = DEAL_STAGES.indexOf(stage as DealStage)

  // Update property's deal_stage
  const { error: updateError } = await supabase
    .from('pi_properties')
    .update({ deal_stage: stage, stage_updated_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('user_id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Build history rows — backfill skipped intermediate stages
  const historyInserts: {
    property_id: number
    user_id: string
    stage: DealStage
    entered_by: string
    notes: string | null
  }[] = []

  if (toIndex > fromIndex + 1) {
    for (let i = fromIndex + 1; i < toIndex; i++) {
      historyInserts.push({
        property_id: propertyId,
        user_id: user.id,
        stage: DEAL_STAGES[i],
        entered_by: user.id,
        notes: 'Completed — recorded when setting current stage',
      })
    }
  }

  historyInserts.push({
    property_id: propertyId,
    user_id: user.id,
    stage: stage as DealStage,
    entered_by: user.id,
    notes: notes?.trim() || null,
  })

  const { data: stageRecords, error: stageError } = await supabase
    .from('pi_deal_stage_history')
    .insert(historyInserts)
    .select()

  if (stageError) return NextResponse.json({ error: stageError.message }, { status: 500 })

  // Seed checklist tasks for the target stage (if template exists)
  const template = STAGE_CHECKLIST_TEMPLATES[stage as DealStage]
  let seededTasks: unknown[] = []
  if (template && template.length > 0) {
    const taskRows = template.map((t, i) => ({
      property_id: propertyId,
      user_id: user.id,
      title: t.title,
      kind: t.kind,
      stage: stage as DealStage,
      sort_order: i,
    }))
    const { data: tasks } = await supabase
      .from('pi_deal_tasks')
      .insert(taskRows)
      .select()
    seededTasks = tasks ?? []
  }

  return NextResponse.json(
    {
      stage,
      history: stageRecords,
      backfilled: Math.max(0, toIndex - fromIndex - 1),
      seeded_tasks: seededTasks.length,
    },
    { status: 201 }
  )
}
