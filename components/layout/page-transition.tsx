"use client"

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      {children}
    </div>
  )
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div
      className={`animate-in fade-in slide-in-from-bottom-3 duration-300 ${className ?? ""}`}
      style={delay ? { animationDelay: `${delay}s`, animationFillMode: "both" } : undefined}
    >
      {children}
    </div>
  )
}

export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`animate-in fade-in slide-in-from-bottom-4 duration-300 ${className ?? ""}`}>
      {children}
    </div>
  )
}
