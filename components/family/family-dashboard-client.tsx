"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import type { Family, FamilyMember, Suggestion, Trip } from "@/lib/types/family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Users, Star, Plane, CalendarDays, MapPin, ChevronRight,
  Lightbulb, Award
} from "lucide-react"
import { SUGGESTION_STATUS_STYLES, TRIP_STATUS_LABELS, ACTIVITY_KIND_LABELS } from "@/lib/constants/family"
import { format } from "date-fns"

interface Props {
  family: Family
  myMember: FamilyMember | null
  members: FamilyMember[]
  topSuggestions: Suggestion[]
  upcomingTrips: Trip[]
}

export function FamilyDashboardClient({ family, myMember, members, topSuggestions, upcomingTrips }: Props) {
  const { familyId } = useParams() as { familyId: string }
  const base = `/apps/family/${familyId}`

  const activeMembers = members.filter((m) => m.status === "active")

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/apps/family" className="text-muted-foreground hover:text-foreground text-sm">
              Families
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">{family.name}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">{family.name}</h1>
          {family.home_location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {family.home_location}
            </p>
          )}
        </div>
        {myMember?.role === "admin" && (
          <Link href={`${base}/members`}>
            <Button size="sm" variant="outline">Manage Members</Button>
          </Link>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Members", value: activeMembers.length, icon: Users, href: `${base}/members` },
          { label: "Suggestions", value: topSuggestions.length, icon: Lightbulb, href: `${base}/suggestions` },
          { label: "Trips", value: upcomingTrips.length, icon: Plane, href: `${base}/trips` },
          { label: "Places Saved", value: "—", icon: MapPin, href: `${base}/places` },
        ].map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top suggestions */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Top Suggestions
            </CardTitle>
            <Link href={`${base}/suggestions`}>
              <Button size="sm" variant="ghost" className="h-7 text-xs">View all <ChevronRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No suggestions yet — add some!</p>
            ) : (
              topSuggestions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ACTIVITY_KIND_LABELS[s.kind]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.score != null && (
                      <span className="text-xs font-semibold text-primary">{Math.round(s.score)}</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${SUGGESTION_STATUS_STYLES[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))
            )}
            <Link href={`${base}/suggestions`}>
              <Button size="sm" variant="outline" className="w-full mt-2">
                <Award className="w-4 h-4 mr-1" /> Browse & Vote
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming trips */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Plane className="w-4 h-4 text-blue-500" /> Upcoming Trips
            </CardTitle>
            <Link href={`${base}/trips`}>
              <Button size="sm" variant="ghost" className="h-7 text-xs">View all <ChevronRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No trips planned yet</p>
            ) : (
              upcomingTrips.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.start_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {format(new Date(t.start_date), "MMM d, yyyy")}
                        {t.end_date && ` – ${format(new Date(t.end_date), "MMM d")}`}
                      </p>
                    )}
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    {TRIP_STATUS_LABELS[t.status]}
                  </span>
                </div>
              ))
            )}
            <Link href={`${base}/trips`}>
              <Button size="sm" variant="outline" className="w-full mt-2">
                <Plane className="w-4 h-4 mr-1" /> Plan a Trip
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Interests", href: `${base}/interests`, icon: Star },
          { label: "Availability", href: `${base}/availability`, icon: CalendarDays },
          { label: "Places", href: `${base}/places`, icon: MapPin },
          { label: "Suggestions", href: `${base}/suggestions`, icon: Lightbulb },
        ].map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href}>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Icon className="w-4 h-4" /> {label}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}
