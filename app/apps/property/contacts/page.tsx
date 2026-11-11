import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import Link from 'next/link'
import { ContactCard } from '@/components/property/contacts/contact-card'
import { ContactsClientPage } from './contacts-client'

interface ContactsPageProps {
  searchParams: Promise<{ type?: string; q?: string }>
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const { supabase, user } = await requireAuth()
  const { type, q } = await searchParams

  let query = supabase
    .from('pi_contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (type) query = query.eq('contact_type', type)

  const { data: contacts } = await query

  // Count deals per contact
  const contactIds = (contacts ?? []).map((c) => c.id)
  let dealCounts: Record<string, number> = {}
  if (contactIds.length > 0) {
    const { data: dealContacts } = await supabase
      .from('pi_deal_contacts')
      .select('contact_id')
      .in('contact_id', contactIds)
    for (const dc of dealContacts ?? []) {
      dealCounts[dc.contact_id] = (dealCounts[dc.contact_id] ?? 0) + 1
    }
  }

  return (
    <ContactsClientPage
      contacts={(contacts ?? []) as never}
      dealCounts={dealCounts}
      filterType={type}
    />
  )
}
