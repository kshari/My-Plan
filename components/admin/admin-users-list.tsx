'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ShieldCheck, Shield, Trash2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { parseLocalDate } from '@/lib/utils/formatting'

interface AdminRecord {
  id: string
  user_id: string
  email: string
  role: string
  created_by: string | null
  created_at: string
}

interface AdminUsersListProps {
  initialAdmins: AdminRecord[]
  currentUserId: string
}

export function AdminUsersList({ initialAdmins, currentUserId }: AdminUsersListProps) {
  const supabase = createClient()
  const [admins, setAdmins] = useState<AdminRecord[]>(initialAdmins)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const addAdmin = useCallback(async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    if (admins.some((a) => a.email.toLowerCase() === trimmed)) {
      toast.error('This user is already an admin.')
      return
    }

    setAdding(true)

    const { data: userData, error: lookupError } = await supabase
      .rpc('get_user_id_by_email', { lookup_email: trimmed })

    if (lookupError || !userData) {
      toast.error('No user found with that email. They must have an account first.')
      setAdding(false)
      return
    }

    const { data: newAdmin, error: insertError } = await supabase
      .from('admins')
      .insert({
        user_id: userData,
        email: trimmed,
        role: 'admin',
        created_by: currentUserId,
      })
      .select()
      .single()

    if (insertError) {
      toast.error(insertError.message || 'Failed to add admin.')
    } else if (newAdmin) {
      setAdmins((prev) => [...prev, newAdmin as AdminRecord])
      setEmail('')
      toast.success(`${trimmed} added as admin.`)
    }
    setAdding(false)
  }, [supabase, email, admins, currentUserId])

  const removeAdmin = useCallback(async (adminId: string, adminEmail: string) => {
    const superAdminCount = admins.filter((a) => a.role === 'super_admin').length
    const target = admins.find((a) => a.id === adminId)

    if (target?.user_id === currentUserId) {
      toast.error('You cannot remove yourself.')
      return
    }
    if (target?.role === 'super_admin' && superAdminCount <= 1) {
      toast.error('Cannot remove the last super admin.')
      return
    }

    const { error } = await supabase.from('admins').delete().eq('id', adminId)
    if (error) {
      toast.error('Failed to remove admin.')
      return
    }
    setAdmins((prev) => prev.filter((a) => a.id !== adminId))
    toast.success(`${adminEmail} removed from admins.`)
  }, [supabase, admins, currentUserId])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Admin Users</h1>
        <p className="text-sm text-muted-foreground">Manage who has admin access to the platform.</p>
      </div>

      {/* Add admin form */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          Add Admin
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAdmin()}
            className="flex-1"
          />
          <Button onClick={addAdmin} disabled={adding || !email.trim()} size="sm">
            {adding ? 'Adding...' : 'Add'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          The user must already have an account on the platform.
        </p>
      </div>

      {/* Admin list */}
      <div className="space-y-2">
        {admins.map((admin) => {
          const isSelf = admin.user_id === currentUserId
          const isSuperAdmin = admin.role === 'super_admin'
          return (
            <div
              key={admin.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3',
                isSelf && 'ring-1 ring-primary/20',
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  isSuperAdmin ? 'bg-primary/10' : 'bg-muted',
                )}>
                  {isSuperAdmin
                    ? <ShieldCheck className="h-4 w-4 text-primary" />
                    : <Shield className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{admin.email}</p>
                    {isSelf && (
                      <Badge variant="secondary" className="text-[10px]">You</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isSuperAdmin ? 'Super Admin' : 'Admin'}
                    {' · Added '}
                    {parseLocalDate(admin.created_at.split('T')[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              {!isSelf && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeAdmin(admin.id, admin.email)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
