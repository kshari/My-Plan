"use client"

import { Suspense } from "react"
import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Handshake, Loader2, CheckCircle2, XCircle, Mail, User, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_TYPE_LABELS } from "@/lib/constants/partnerships"
import type { EntityType } from "@/lib/types/partnerships"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface InvitationInfo {
  invitation: { id: string; status: string; expires_at: string; invite_email: string | null }
  entity: { id: string; name: string; entity_type: EntityType } | null
  placeholder_name: string | null
}

function JoinContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)

  const [displayName, setDisplayName] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided.")
      setLoading(false)
      return
    }

    const supabase = createClient()

    Promise.all([
      fetch(`/api/partnerships/join?token=${token}`).then((r) => r.json()),
      supabase.auth.getUser(),
    ])
      .then(([invData, { data: { user } }]) => {
        setCurrentUser(user ?? null)
        if (invData.error) {
          setError(invData.error)
        } else {
          setInfo(invData)
          setDisplayName(
            invData.placeholder_name ||
            user?.user_metadata?.full_name ||
            user?.email?.split("@")[0] ||
            ""
          )
          setUserEmail(user?.email ?? invData.invitation.invite_email ?? null)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invitation."))
      .finally(() => setLoading(false))
  }, [token])

  async function handleJoin() {
    if (!displayName.trim()) return
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch("/api/partnerships/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, display_name: displayName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          router.push(`/apps/partnerships/${data.entityId}`)
          return
        }
        throw new Error(data.error ?? "Failed to join")
      }
      setJoined(true)
      setTimeout(() => router.push(`/apps/partnerships/${data.entityId}`), 1800)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join")
    } finally {
      setJoining(false)
    }
  }

  const loginUrl = `/login?next=${encodeURIComponent(`/partnerships/join?token=${token}`)}`
  const signupUrl = `/login?signup=1&next=${encodeURIComponent(`/partnerships/join?token=${token}`)}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Handshake className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold tracking-tight">Partnerships</p>
              <p className="text-xs text-muted-foreground">by My Plan</p>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">Loading invitation...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <div>
                <h2 className="text-lg font-semibold">Could not load invitation</h2>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/">Go to Home</Link>
              </Button>
            </div>
          )}

          {!loading && joined && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <div>
                <h2 className="text-lg font-semibold">You&apos;re in!</h2>
                <p className="mt-1 text-sm text-muted-foreground">Redirecting to the entity...</p>
              </div>
            </div>
          )}

          {!loading && !error && !joined && info && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">You&apos;re invited</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentUser
                    ? "Review your details and confirm to join."
                    : "Sign in to accept this invitation."}
                </p>
              </div>

              <div className="rounded-xl bg-muted/60 p-4 space-y-1.5">
                <div className="flex items-start gap-3">
                  <Handshake className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{info.entity?.name ?? "Unknown Entity"}</p>
                    <p className="text-sm text-muted-foreground">
                      {info.entity ? ENTITY_TYPE_LABELS[info.entity.entity_type] : ""}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  Expires: {new Date(info.invitation.expires_at).toLocaleDateString()}
                </p>
              </div>

              <Separator />

              {/* Not logged in */}
              {!currentUser && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    You need to be signed in to accept this invitation.
                  </p>
                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    <Link href={loginUrl}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in to accept
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={signupUrl}>Create a free account</Link>
                  </Button>
                </div>
              )}

              {/* Logged in */}
              {currentUser && (
                <>
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Confirm your profile</h2>
                    <p className="text-xs text-muted-foreground">
                      Your name and email will be visible to all members of this entity.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="join_name" className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Full Name *
                      </Label>
                      <Input
                        id="join_name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        autoFocus
                      />
                      {info.placeholder_name && info.placeholder_name !== displayName && (
                        <p className="text-xs text-muted-foreground">
                          Pre-filled from invitation. Edit if needed.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Email Address
                      </Label>
                      {userEmail ? (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                          <span className="flex-1 text-muted-foreground">{userEmail}</span>
                          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-medium">
                            Verified
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No email on your account.
                        </p>
                      )}
                    </div>
                  </div>

                  {joinError && (
                    <p className="text-sm text-destructive text-center">{joinError}</p>
                  )}

                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleJoin}
                    disabled={joining || !displayName.trim()}
                  >
                    {joining ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Confirm & Join Entity"
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function JoinPartnershipPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  )
}
