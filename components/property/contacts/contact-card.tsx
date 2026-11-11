import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CONTACT_TYPE_LABELS, DEAL_STAGE_BADGE_STYLES } from '@/lib/constants/property-defaults'
import type { Contact } from '@/lib/types/property-lifecycle'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, MapPin, Star } from 'lucide-react'

interface ContactCardProps {
  contact: Contact
  dealCount?: number
}

export function ContactCard({ contact, dealCount }: ContactCardProps) {
  return (
    <Link href={`/apps/property/contacts/${contact.id}`} className="block">
      <div className="rounded-xl border border-border bg-card p-4 hover:border-emerald-500/50 hover:bg-accent/30 transition-all space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm leading-tight">{contact.name}</h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>
          <Badge className="text-xs shrink-0 bg-muted text-muted-foreground">
            {CONTACT_TYPE_LABELS[contact.contact_type]}
          </Badge>
        </div>

        <div className="space-y-1">
          {contact.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              {contact.email}
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              {contact.phone}
            </div>
          )}
          {contact.market && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {contact.market}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          {contact.rating && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: contact.rating }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
          )}
          {dealCount != null && dealCount > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {dealCount} deal{dealCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
