// Property app layout - uses root layout for HTML/body structure
// This layout only provides property-specific metadata if needed

export default function PropertyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No HTML/body tags here - they're handled by root layout
  // This is just a wrapper for property app routes
  return <>{children}</>
}
