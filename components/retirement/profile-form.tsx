'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ErrorMessage } from '@/components/ui/error-message'
import type { User } from '@supabase/supabase-js'

function isGoogleUser(user: User | null): boolean {
  if (!user) return false
  const provider = (user.app_metadata as { provider?: string })?.provider
  if (provider === 'google') return true
  const identities = user.identities ?? []
  return identities.some((id: { provider?: string }) => id.provider === 'google')
}

export default function ProfileForm() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u))
  }, [supabase])

  const googleUser = isGoogleUser(user)

  async function handleUpdateEmail(formData: FormData) {
    setLoading(true)
    setMessage(null)

    const newEmail = formData.get('email') as string

    const { error } = await supabase.auth.updateUser({ email: newEmail })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Check your email to confirm the new address' })
    }

    setLoading(false)
  }

  async function handleUpdatePassword(formData: FormData) {
    setLoading(true)
    setMessage(null)

    const newPassword = formData.get('password') as string

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully' })
    }

    setLoading(false)
  }

  if (user == null) {
    return (
      <div className="text-sm text-muted-foreground">Loading profile…</div>
    )
  }

  if (googleUser) {
    return (
      <div className="space-y-8">
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You signed in with Google. Account details are managed by your Google account.
        </div>
        {message && (
          message.type === 'error'
            ? <ErrorMessage message={message.text} />
            : <div className="rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-950/50 dark:text-green-200">{message.text}</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">Update Email</h3>
        <form action={handleUpdateEmail} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Update Email
          </button>
        </form>
      </div>

      <div className="border-t pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">Update Password</h3>
        <form action={handleUpdatePassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Update Password
          </button>
        </form>
      </div>

      {message && (
        message.type === 'error'
          ? <ErrorMessage message={message.text} />
          : <div className="rounded-md bg-green-50 p-4 text-green-800">{message.text}</div>
      )}
    </div>
  )
}
