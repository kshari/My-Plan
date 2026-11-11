'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CONTACT_TYPES, CONTACT_TYPE_LABELS } from '@/lib/constants/property-defaults'
import type { Contact, ContactType } from '@/lib/types/property-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Check, ChevronsUpDown, UserRound, UserPlus, Loader2 } from 'lucide-react'

interface ContactPickerProps {
  filterType?: ContactType
  selectedId: string | null
  selectedName: string
  onSelect: (id: string | null, name: string) => void
  placeholder?: string
  className?: string
  /** Default type pre-filled when creating a new contact from this picker. */
  defaultNewType?: ContactType
}

export function ContactPicker({
  filterType,
  selectedId,
  selectedName,
  onSelect,
  placeholder = 'Pick a contact...',
  className,
  defaultNewType,
}: ContactPickerProps) {
  const supabase = createClient()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  async function loadContacts() {
    setLoading(true)
    let query = supabase.from('pi_contacts').select('*').order('name', { ascending: true })
    if (filterType) query = query.eq('contact_type', filterType)
    const { data } = await query
    setContacts((data as Contact[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!open) return
    loadContacts()
  }, [open, filterType])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleNewContactSaved(contact: Contact) {
    setContacts((prev) => [contact, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
    onSelect(contact.id, contact.name)
    setAddOpen(false)
    setOpen(false)
  }

  return (
    <>
      <div ref={containerRef} className={cn('relative', className)}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            'justify-between h-8 text-xs font-normal w-full',
            !selectedId && 'text-muted-foreground'
          )}
          onClick={() => setOpen((v) => !v)}
        >
          {selectedId ? (
            <span className="flex items-center gap-1.5 truncate">
              <UserRound className="h-3 w-3 shrink-0" />
              <span className="truncate">{selectedName}</span>
            </span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div className="absolute z-50 top-full mt-1 w-72 rounded-lg border border-border bg-popover shadow-md p-2 left-0">
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs mb-2"
              autoFocus
            />

            {loading ? (
              <p className="text-xs text-muted-foreground p-2 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </p>
            ) : (
              <ul className="max-h-48 overflow-y-auto space-y-0.5">
                {selectedId && (
                  <li>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs text-muted-foreground"
                      onClick={() => { onSelect(null, ''); setSearch(''); setOpen(false) }}
                    >
                      Clear selection
                    </button>
                  </li>
                )}
                {filtered.length === 0 && (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground">
                    {search ? `No contacts match "${search}"` : 'No contacts found.'}
                  </li>
                )}
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2"
                      onClick={() => { onSelect(c.id, c.name); setSearch(''); setOpen(false) }}
                    >
                      <Check className={cn('h-3 w-3 shrink-0', selectedId === c.id ? 'opacity-100' : 'opacity-0')} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {CONTACT_TYPE_LABELS[c.contact_type]}{c.company ? ` · ${c.company}` : ''}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add new contact inline */}
            <div className="border-t border-border mt-2 pt-2">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-primary hover:bg-accent transition-colors"
                onClick={() => { setOpen(false); setAddOpen(true) }}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                Add new contact…
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline new-contact dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <InlineContactForm
            defaultType={defaultNewType ?? filterType ?? 'other'}
            onSaved={handleNewContactSaved}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Lightweight inline form (avoids router.push used in full ContactForm) ──────

interface InlineContactFormProps {
  defaultType: ContactType
  onSaved: (contact: Contact) => void
  onCancel: () => void
}

function InlineContactForm({ defaultType, onSaved, onCancel }: InlineContactFormProps) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [contactType, setContactType] = useState<ContactType>(defaultType)
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaving(false); setError('Not authenticated'); return }

    const { data, error: err } = await supabase
      .from('pi_contacts')
      .insert([{
        user_id: authData.user.id,
        name: name.trim(),
        contact_type: contactType,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      }])
      .select()
      .single()

    if (err || !data) { setError(err?.message ?? 'Failed to save'); setSaving(false); return }
    onSaved(data as Contact)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
            placeholder="Full name"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={contactType} onValueChange={(v) => setContactType(v as ContactType)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTACT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Company</label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Phone</label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Add Contact
        </Button>
      </div>
    </div>
  )
}
