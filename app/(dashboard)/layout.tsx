import { ReactNode } from 'react'

// This layout ensures no header/footer appears for the dashboard group
export default function RootDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
} 