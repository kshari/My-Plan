'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import {
  CONTACT_TYPES, CONTACT_TYPE_LABELS,
} from '@/lib/constants/property-defaults'
import type { Contact, ContactType } from '@/lib/types/property-lifecycle'
import { ContactCard } from '@/components/property/contacts/contact-card'
import { ContactForm } from '@/components/property/contacts/contact-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { BookUser, Plus, Search } from 'lucide-react'

interface ContactsClientPageProps {
  contacts: Contact[]
  dealCounts: Record<string, number>
  filterType?: string
}

export function ContactsClientPage({ contacts, dealCounts, filterType }: ContactsClientPageProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<ContactType | 'all'>(
    (filterType as ContactType) ?? 'all'
  )

  const filtered = contacts.filter((c) => {
    const matchesType = selectedType === 'all' || c.contact_type === selectedType
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      (c.market ?? '').toLowerCase().includes(q)
    return matchesType && matchesSearch
  })

  return (
    <div className={PAGE_CONTAINER}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookUser className="h-6 w-6 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold">Network</h1>
            <p className="text-sm text-muted-foreground">{contacts.length} contacts</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedType === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            All
          </button>
          {CONTACT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t === selectedType ? 'all' : t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedType === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {CONTACT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookUser className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {contacts.length === 0
              ? 'No contacts yet. Add your first agent, lender, or contractor.'
              : 'No contacts match the filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} dealCount={dealCounts[c.id]} />
          ))}
        </div>
      )}

      {/* Add contact dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            onSaved={() => { setAddOpen(false); router.refresh() }}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
