'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  CONTACT_TYPE_LABELS, DEAL_STAGE_LABELS, DEAL_STAGE_BADGE_STYLES,
} from '@/lib/constants/property-defaults'
import type { Contact, DealStage } from '@/lib/types/property-lifecycle'
import type { LinkedProperty } from './page'
import { ContactForm } from '@/components/property/contacts/contact-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Mail, Phone, MapPin, Star, Pencil, Trash2, Building2 } from 'lucide-react'
import Link from 'next/link'

interface ContactDetailClientProps {
  contact: Contact
  linkedProperties: LinkedProperty[]
}

export function ContactDetailClient({ contact: initialContact, linkedProperties }: ContactDetailClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [contact, setContact] = useState<Contact>(initialContact)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete ${contact.name}? This will also unlink them from any deals.`)) return
    setDeleting(true)
    await supabase.from('pi_contacts').delete().eq('id', contact.id)
    router.push('/apps/property/contacts')
    router.refresh()
  }

  return (
    <div className="mt-4 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            <Badge className="text-xs bg-muted text-muted-foreground">
              {CONTACT_TYPE_LABELS[contact.contact_type]}
            </Badge>
          </div>
          {contact.company && (
            <p className="text-muted-foreground mt-0.5">{contact.company}</p>
          )}
          {contact.rating && (
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: contact.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-sm">Contact Info</h3>
        <dl className="space-y-2">
          {contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
            </div>
          )}
          {contact.market && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{contact.market}</span>
            </div>
          )}
        </dl>
        {contact.notes && (
          <p className="text-sm text-muted-foreground border-t border-border pt-3 whitespace-pre-wrap">
            {contact.notes}
          </p>
        )}
      </div>

      {/* Linked properties */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">
            Linked Properties
            <span className="ml-2 text-muted-foreground font-normal text-xs">
              ({linkedProperties.length})
            </span>
          </h3>
        </div>

        {linkedProperties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not linked to any properties yet. Links appear automatically when this contact
            is assigned as a tenant, property manager, contractor, or deal contact on a property.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {linkedProperties.map((lp) => (
              <li key={lp.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <Link
                      href={`/apps/property/properties/${lp.id}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {lp.address || 'Untitled'}
                    </Link>
                    {lp.city && (
                      <span className="text-sm text-muted-foreground"> · {lp.city}</span>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{lp.relation}</p>
                  </div>
                  <Badge
                    className={cn(
                      'text-xs shrink-0',
                      DEAL_STAGE_BADGE_STYLES[lp.deal_stage as DealStage] ?? 'bg-muted text-muted-foreground'
                    )}
                  >
                    {DEAL_STAGE_LABELS[lp.deal_stage as DealStage] ?? lp.deal_stage}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            contact={contact}
            onSaved={(updated) => { setContact(updated); setEditOpen(false) }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
