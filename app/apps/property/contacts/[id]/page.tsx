import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ContactDetailClient } from './contact-detail-client'

interface ContactDetailPageProps {
  params: Promise<{ id: string }>
}

export interface LinkedProperty {
  id: number
  address: string | null
  city: string | null
  deal_stage: string
  /** How this contact is linked to this property. */
  relation: string
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = await params
  const { supabase, user } = await requireAuth()

  const { data: contact, error } = await supabase
    .from('pi_contacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !contact) notFound()

  // Fetch all ways this contact can be linked to a property in parallel:
  const [
    { data: dealContacts },       // via pi_deal_contacts join table
    { data: pmProperties },       // via pi_properties.pm_contact_id
    { data: leases },             // via pi_leases.tenant_contact_id
    { data: rehabItems },         // via pi_rehab_items.contractor_contact_id
    { data: workOrders },         // via pi_work_orders.contractor_contact_id
  ] = await Promise.all([
    supabase
      .from('pi_deal_contacts')
      .select('role, notes, property:pi_properties(id, address, city, deal_stage)')
      .eq('contact_id', id),
    supabase
      .from('pi_properties')
      .select('id, address, city, deal_stage')
      .eq('pm_contact_id', id)
      .eq('user_id', user.id),
    supabase
      .from('pi_leases')
      .select('property_id, unit_label, pi_properties(id, address, city, deal_stage)')
      .eq('tenant_contact_id', id)
      .eq('user_id', user.id),
    supabase
      .from('pi_rehab_items')
      .select('description, property_id, pi_properties(id, address, city, deal_stage)')
      .eq('contractor_contact_id', id)
      .eq('user_id', user.id),
    supabase
      .from('pi_work_orders')
      .select('title, property_id, pi_properties(id, address, city, deal_stage)')
      .eq('contractor_contact_id', id)
      .eq('user_id', user.id),
  ])

  // Merge into a unified list, deduplicating by property id
  const propertyMap = new Map<number, LinkedProperty>()

  function addProperty(
    prop: { id: number; address: string | null; city: string | null; deal_stage: string } | null,
    relation: string
  ) {
    if (!prop) return
    const existing = propertyMap.get(prop.id)
    if (existing) {
      // Append additional relation if not already listed
      if (!existing.relation.includes(relation)) {
        existing.relation = `${existing.relation}, ${relation}`
      }
    } else {
      propertyMap.set(prop.id, { ...prop, relation })
    }
  }

  for (const dc of dealContacts ?? []) {
    const prop = dc.property as { id: number; address: string | null; city: string | null; deal_stage: string } | null
    addProperty(prop, dc.role ? `Deal contact (${dc.role})` : 'Deal contact')
  }
  for (const p of pmProperties ?? []) {
    addProperty(p as { id: number; address: string | null; city: string | null; deal_stage: string }, 'Property manager')
  }
  for (const l of leases ?? []) {
    const prop = (l as Record<string, unknown>)['pi_properties'] as { id: number; address: string | null; city: string | null; deal_stage: string } | null
    const unit = (l as Record<string, unknown>)['unit_label'] as string | null
    addProperty(prop, unit ? `Tenant (Unit ${unit})` : 'Tenant')
  }
  for (const r of rehabItems ?? []) {
    const prop = (r as Record<string, unknown>)['pi_properties'] as { id: number; address: string | null; city: string | null; deal_stage: string } | null
    addProperty(prop, `Contractor – ${(r as Record<string, unknown>)['description'] ?? 'rehab'}`)
  }
  for (const w of workOrders ?? []) {
    const prop = (w as Record<string, unknown>)['pi_properties'] as { id: number; address: string | null; city: string | null; deal_stage: string } | null
    addProperty(prop, `Contractor – ${(w as Record<string, unknown>)['title'] ?? 'work order'}`)
  }

  const linkedProperties = Array.from(propertyMap.values())

  return (
    <div className={PAGE_CONTAINER}>
      <Link href="/apps/property/contacts" className={BACK_LINK}>
        ← Network
      </Link>
      <ContactDetailClient
        contact={contact as never}
        linkedProperties={linkedProperties}
      />
    </div>
  )
}
