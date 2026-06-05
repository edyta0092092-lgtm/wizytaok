"use client"

import * as React from "react"
import { useParams } from "next/navigation"

import { CustomerProfileView } from "@/components/customers/customer-profile-view"
import { CustomersListSkeleton } from "@/components/customers/customers-list-skeleton"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { buildCustomerCrmRows } from "@/lib/customers/build-customer-crm"
import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { loadClientsWorkspace } from "@/lib/clients/clients-store"
import { getBookingsForBusiness } from "@/lib/bookings/bookings-store"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import Link from "next/link"

export default function KlienciProfilePage() {
  const params = useParams()
  const id = typeof params.id === "string" ? decodeURIComponent(params.id) : ""
  const { t } = useTranslations()
  const { ready: accessReady, businessId } = useBusinessAccess()
  const [ready, setReady] = React.useState(false)
  const [customer, setCustomer] = React.useState<ReturnType<typeof buildCustomerCrmRows>[number] | null>(
    null,
  )

  React.useEffect(() => {
    if (!accessReady || !businessId || !id) {
      queueMicrotask(() => {
        setCustomer(null)
        setReady(true)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => setReady(false))

    void (async () => {
      try {
        const workspace = await loadClientsWorkspace({ businessId })
        let appointments = await fetchMergedAppointments({ businessId })
        const sb = getBrowserClient()
        if (sb && isSupabaseConfigured()) {
          const fromSb = await getBookingsForBusiness(sb, businessId, workspace.businessSlug ?? "")
          if (fromSb.length > 0) appointments = fromSb
        }
        if (cancelled) return
        const rows = buildCustomerCrmRows(workspace.clients, appointments)
        setCustomer(rows.find((r) => r.id === id) ?? null)
      } catch {
        if (!cancelled) setCustomer(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accessReady, businessId, id])

  const title = customer?.fullName ?? t("customers.profile.title")

  return (
    <AppShell title={title} pageDescription={t("customers.profile.description")}>
      <PageShell>
        <div className="mx-auto w-full max-w-[900px]">
          {!ready ? <CustomersListSkeleton /> : null}
          {ready && !customer ? (
            <div className="space-y-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("customers.profile.notFound")}</p>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/klienci">{t("customers.profile.backToList")}</Link>
              </Button>
            </div>
          ) : null}
          {ready && customer ? <CustomerProfileView customer={customer} /> : null}
        </div>
      </PageShell>
    </AppShell>
  )
}
