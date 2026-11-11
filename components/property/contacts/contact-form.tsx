'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CONTACT_TYPES, CONTACT_TYPE_LABELS } from '@/lib/constants/property-defaults'
import type { Contact, ContactType } from '@/lib/types/property-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface ContactFormProps {
  contact?: Contact
  onSaved?: (contact: Contact) => void
  onCancel?: () => void
}

export function ContactForm({ contact, onSaved, onCancel }: ContactFormProps) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(contact?.name ?? '')
  const [contactType, setContactType] = useState<ContactType>(contact?.contact_type ?? 'other')
  const [company, setCompany] = useState(contact?.company ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [market, setMarket] = useState(contact?.market ?? '')
  const [rating, setRating] = useState(contact?.rating?.toString() ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaving(false); setError('Not authenticated'); return }

    const payload = {
      user_id: authData.user.id,
      name: name.trim(),
      contact_type: contactType,
      company: company.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      market: market.trim() || null,
      rating: rating ? parseInt(rating) : null,
      notes: notes.trim() || null,
    }

    let result
    if (contact) {
      result = await supabase
        .from('pi_contacts')
        .update(payload)
        .eq('id', contact.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('pi_contacts')
        .insert([payload])
        .select()
        .single()
    }

    if (result.error) { setError(result.error.message); setSaving(false); return }
    setSaving(false)
    if (onSaved) {
      onSaved(result.data as Contact)
    } else {
      router.push('/apps/property/contacts')
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={contactType} onValueChange={(v) => setContactType(v as ContactType)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTACT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Company</label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Phone</label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Market / Area</label>
          <Input value={market} onChange={(e) => setMarket(e.target.value)} className="h-9" placeholder="e.g. Orlando" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Rating (1-5)</label>
          <Select value={rating || 'none'} onValueChange={(v) => setRating(v === 'none' ? '' : v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{'⭐'.repeat(n)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Notes</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {contact ? 'Save Changes' : 'Add Contact'}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </div>
  )
}
