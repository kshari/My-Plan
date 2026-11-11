import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import { PipelineClient } from './pipeline-client'

export default async function PipelinePage() {
  const { supabase, user } = await requireAuth()

  const { data: properties } = await supabase
    .from('pi_properties')
    .select('id, address, city, type, "Asking Price", deal_stage, stage_updated_at')
    .eq('user_id', user.id)
    .order('stage_updated_at', { ascending: false, nullsFirst: false })

  const allDeals = (properties ?? []).filter((d) => d.deal_stage != null)

  return (
    <div className={PAGE_CONTAINER}>
      <PipelineClient allDeals={allDeals} initialView="list" />
    </div>
  )
}
