"use client"

import { usePathname } from "next/navigation"

import { ClientPortalGate } from "@/components/client-portal/client-portal-gate"
import { ClientPortalShell } from "@/components/client-portal/client-portal-shell"
import { isClientPortalLoginPath } from "@/lib/client-portal/client-portal-auth"

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (isClientPortalLoginPath(pathname)) {
    return <>{children}</>
  }

  return (
    <ClientPortalGate>
      <ClientPortalShell>{children}</ClientPortalShell>
    </ClientPortalGate>
  )
}
