'use client'

import Link from 'next/link'
import { Users, ChevronRight, Crown, Shield, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import type { Team, TeamMember } from '@/lib/types/teams'

interface TeamWithMembership {
  role: TeamMember['role']
  joined_at: string
  teams: Team & { team_members: { count: number }[] }
}

interface TeamListProps {
  teams: TeamWithMembership[]
  currentUserId: string
}

const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  admin: { label: 'Admin', icon: Shield, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  member: { label: 'Member', icon: User, className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

export default function TeamList({ teams, currentUserId }: TeamListProps) {
  if (!teams.length) {
    return (
      <EmptyState
        icon={Users}
        message="No teams yet"
        description="Create a team to start sharing properties with colleagues."
        action={
          <Link href="/apps/property/teams/new">
            <Button>Create your first team</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {teams.map(({ role, joined_at, teams: team }) => {
        const roleConfig = ROLE_CONFIG[role]
        const RoleIcon = roleConfig.icon
        const memberCount = team.team_members?.[0]?.count ?? 0

        return (
          <Link
            key={team.id}
            href={`/apps/property/teams/${team.id}`}
            className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{team.name}</p>
                  <Badge className={`text-xs px-2 py-0 ${roleConfig.className}`}>
                    <RoleIcon className="h-3 w-3 mr-1" />
                    {roleConfig.label}
                  </Badge>
                </div>
                {team.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{team.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {memberCount} member{memberCount !== 1 ? 's' : ''} &middot; Joined {new Date(joined_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
