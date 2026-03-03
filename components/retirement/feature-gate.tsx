'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeatureGateProps {
  featureName: string
  description?: string
}

/**
 * Displayed in place of a locked tab/feature for unauthenticated (local) users.
 * Prompts them to create a free account to unlock.
 */
export function FeatureGate({ featureName, description }: FeatureGateProps) {
  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="text-center max-w-sm space-y-4">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold">{featureName}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {description || `${featureName} requires a free account. Sign up to unlock this and more advanced features.`}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button asChild>
            <Link href="/signup">Sign Up Free</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
