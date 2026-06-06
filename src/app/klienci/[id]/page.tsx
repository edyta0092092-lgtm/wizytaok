"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

import { CustomerProfileView } from "@/components/customers/customer-profile-view"
import { CustomersListSkeleton } from "@/components/customers/customers-list-skeleton"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { buildCustomerCrmRows } from "@/lib/customers/build-customer-crm"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { loadClientsWorkspace, type ClientsLoadMode } from "@/lib/clients/clients-store"
import { getBookingsForBusiness } from "@/lib/bookings/bookings-store"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Client } from "@/types/domain"

export default function KlienciProfilePage() {
  const params = useParams()
  const id = typeof params.id === "string" ? decodeURIComponent(params.id) : ""
  const { t } = useTranslations()
  const { ready: accessReady, businessId } = useBusinessAccess()
  const [ready, setReady] = React.useState(false)
  const [customer, setCustomer] = React.useState<CustomerCrmRow | null>(null)
  const [clients, setClients] = React.useState<Client[]>([])
  const [workspace, setWorkspace] = React.useState<{
    mode: ClientsLoadMode
    businessProfileId: string | null
    businessSlug: string | null
  } | null>(null)

  const loadProfile = React.useCallback(async () => {
    if (!businessId || !id) {
      setCustomer(null)
      setClients([])
      setWorkspace(null)
      setReady(true)
      return
    }

    setReady(false)
    try {
      const loadedWorkspace = await loadClientsWorkspace({ businessId })
      let appointments = await fetchMergedAppointments({ businessId })
      const sb = getBrowserClient()
      if (sb && isSupabaseConfigured()) {
        const fromSb = await getBookingsForBusiness(sb, businessId, loadedWorkspace.businessSlug ?? "")
        if (fromSb.length > 0) appointments = fromSb
      }
      const rows = buildCustomerCrmRows(loadedWorkspace.clients, appointments)
      setClients(loadedWorkspace.clients)
      setWorkspace({
        mode: loadedWorkspace.mode,
        businessProfileId: loadedWorkspace.businessProfileId,
        businessSlug: loadedWorkspace.businessSlug,
      })
      setCustomer(rows.find((r) => r.id === id) ?? null)
    } catch {
      setCustomer(null)
      setClients([])
      setWorkspace(null)
    } finally {
      setReady(true)
    }
  }, [businessId, id])

  React.useEffect(() => {
    if (!accessReady) return
    void loadProfile()
  }, [accessReady, loadProfile])

  React.useEffect(() => {
    const onBookings = () => {
      void loadProfile()
    }
    window.addEventListener("pw-bookings", onBookings)
    return () => window.removeEventListener("pw-bookings", onBookings)
  }, [loadProfile])

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
          {ready && customer && workspace ? (
            <CustomerProfileView
              customer={customer}
              workspace={workspace}
              clients={clients}
              onCustomerUpdated={(updated) => {
                setCustomer(updated)
                setClients((prev) =>
                  prev.map((c) =>
                    c.id === customer.id || c.id === updated.id
                      ? {
                          ...c,
                          id: updated.id,
                          fullName: updated.fullName,
                          phone: updated.phone,
                          email: updated.email,
                          notes: updated.notes,
                          attachments: updated.attachments,
                        }
                      : c,
                  ),
                )
              }}
            />
          ) : null}
        </div>
      </PageShell>
    </AppShell>
  )
}
