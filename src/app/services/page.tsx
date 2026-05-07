"use client"

import * as React from "react"
import { ClipboardList, Clock, Pencil, Trash2 } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { AccessDenied } from "@/components/shared/access-denied"
import { EmptyState } from "@/components/shared/empty-state"
import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import { ServiceHoursSheet } from "@/components/services/service-hours-sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  addService,
  deleteService,
  getCurrentBusinessProfileIdForClient,
  getServices,
  updateService,
} from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Service } from "@/types/domain"

type ServiceFormState = {
  name: string
  description: string
  durationMinutes: string
  price: string
  isActive: boolean
}

const emptyForm = (): ServiceFormState => ({
  name: "",
  description: "",
  durationMinutes: "60",
  price: "",
  isActive: true,
})

function formFromService(service: Service): ServiceFormState {
  return {
    name: service.name,
    description: service.description ?? "",
    durationMinutes: String(service.durationMinutes),
    price: String(service.price),
    isActive: service.isActive,
  }
}

function statusTone(isActive: boolean): "success" | "neutral" {
  return isActive ? "success" : "neutral"
}

export default function ServicesPage() {
  const { t, language } = useTranslations()
  const access = useBusinessAccess()

  const [services, setServices] = React.useState<Service[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [businessProfileId, setBusinessProfileId] = React.useState<string | null>(null)
  const [actionNotice, setActionNotice] = React.useState("")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<ServiceFormState>(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [hoursOpen, setHoursOpen] = React.useState(false)
  const [hoursService, setHoursService] = React.useState<Service | null>(null)
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = React.useState<string | null>(null)

  const refreshServices = React.useCallback(async () => {
    const client = getBrowserClient()
    const profileId = client && isSupabaseConfigured() ? await getCurrentBusinessProfileIdForClient(client) : null
    setBusinessProfileId(profileId)

    try {
      const list = await getServices(client, profileId)
      setServices(list)
      setLoadError(false)
    } catch {
      setServices([])
      setLoadError(true)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      await refreshServices()
      if (!cancelled) setLoading(false)
    }
    void run()

    const onRefresh = () => {
      void refreshServices()
    }
    window.addEventListener("pw-services", onRefresh)
    window.addEventListener("focus", onRefresh)
    return () => {
      cancelled = true
      window.removeEventListener("pw-services", onRefresh)
      window.removeEventListener("focus", onRefresh)
    }
  }, [refreshServices])

  React.useEffect(() => {
    if (!actionNotice) return
    const tid = window.setTimeout(() => setActionNotice(""), 3000)
    return () => window.clearTimeout(tid)
  }, [actionNotice])

  const saveService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const client = getBrowserClient()
    const name = form.name.trim()
    if (!name) {
      setActionNotice(t("services.invalidName"))
      return
    }

    const durationMinutes = Number(form.durationMinutes)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setActionNotice(t("services.invalidDuration"))
      return
    }

    const price = Number(form.price)
    if (!Number.isFinite(price) || price < 0) {
      setActionNotice(t("services.invalidPrice"))
      return
    }

    if (!businessProfileId) {
      setActionNotice("Nie udało się zapisać usługi. Brak profilu firmy.")
      return
    }

    const payload = {
      business_id: businessProfileId,
      name,
      description: form.description.trim() || null,
      duration_minutes: Math.floor(durationMinutes),
      price,
      currency: "PLN",
      is_active: form.isActive,
      sort_order: services.length,
    }

    setSaving(true)
    try {
      if (editingId) {
        const result = await updateService(client, businessProfileId, editingId, {
          name,
          description: form.description.trim() || undefined,
          durationMinutes: Math.floor(durationMinutes),
          price,
          currency: "PLN",
          isActive: form.isActive,
        })
        console.info("[services.save]", {
          businessId: businessProfileId,
          payload,
          error: result.error ?? null,
        })
        if (!result.ok) {
          setActionNotice(`${t("services.saveChangesError")} Szczegóły: ${result.error ?? "unknown_error"}`)
          return
        }
        setActionNotice(t("services.changesSaved"))
      } else {
        const result = await addService(client, businessProfileId, {
          name,
          description: form.description.trim() || undefined,
          durationMinutes: Math.floor(durationMinutes),
          price,
          currency: "PLN",
          isActive: form.isActive,
        })
        console.info("[services.save]", {
          businessId: businessProfileId,
          payload,
          error: result.error ?? null,
        })
        if (!result.ok) {
          setActionNotice(`${t("services.saveError")} Szczegóły: ${result.error ?? "unknown_error"}`)
          return
        }
        setActionNotice(t("services.serviceSaved"))
      }

      await refreshServices()
      setEditingId(null)
      setForm(emptyForm())
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (service: Service) => {
    setEditingId(service.id)
    setForm(formFromService(service))
    setConfirmDeleteServiceId(null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setForm(emptyForm())
  }

  const removeServiceItem = async (serviceId: string) => {
    const client = getBrowserClient()
    const result = await deleteService(client, businessProfileId, serviceId)
    if (!result.ok) {
      setActionNotice(t("services.deleteError"))
      return
    }

    if (result.mode === "hidden") {
      setActionNotice(t("services.hiddenDueToBookings"))
    } else {
      setActionNotice(t("services.serviceDeleted"))
    }
    setConfirmDeleteServiceId(null)
    await refreshServices()
  }

  const totalCount = services.length
  const activeCount = services.filter((service) => service.isActive).length
  const avgDuration =
    totalCount === 0
      ? 0
      : Math.round(services.reduce((sum, service) => sum + service.durationMinutes, 0) / totalCount)
  const avgPrice =
    totalCount === 0 ? 0 : Math.round(services.reduce((sum, service) => sum + service.price, 0) / totalCount)

  if (access.ready && !access.canManageServices) {
    return (
      <AppShell title={t("navigation.services")} pageDescription={t("services.description")}>
        <PageShell>
          <AccessDenied />
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell title={t("navigation.services")} pageDescription={t("services.description")}>
      <PageShell>
        {loading ? (
          <p className="mb-4 text-sm text-muted-foreground" role="status">
            {t("services.loadingServices")}
          </p>
        ) : null}

        {loadError ? (
          <p
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {t("services.loadServicesError")}
          </p>
        ) : null}

        {actionNotice ? (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            {actionNotice}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{t("services.allTitle")}</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums">{totalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{t("services.activeTitle")}</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{t("services.avgDurationTitle")}</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums">
                {avgDuration} {t("services.min")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{t("services.avgPriceTitle")}</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums">
                {avgPrice} {language === "pl" ? t("services.zł") : t("services.PLN")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_1.3fr]">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? t("services.editServiceTitle") : t("services.addServiceTitle")}</CardTitle>
              <CardDescription>{t("services.formDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(event) => void saveService(event)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="service-name">{t("services.serviceNameLabel")}</Label>
                  <Input
                    id="service-name"
                    required
                    value={form.name}
                    placeholder={t("services.placeholderName")}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="service-description">{t("services.serviceDescriptionLabel")}</Label>
                  <Textarea
                    id="service-description"
                    rows={3}
                    placeholder={t("services.placeholderDescription")}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="service-duration">{t("services.durationMinutesLabel")}</Label>
                    <Input
                      id="service-duration"
                      type="number"
                      min={1}
                      step={1}
                      placeholder={t("services.placeholderDuration")}
                      value={form.durationMinutes}
                      onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="service-price">{t("services.priceLabel")}</Label>
                    <Input
                      id="service-price"
                      type="number"
                      min={0}
                      step={1}
                      placeholder={t("services.placeholderPrice")}
                      value={form.price}
                      onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="service-active">{t("services.activeLabel")}</Label>
                    <Switch
                      id="service-active"
                      checked={form.isActive}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, isActive: Boolean(checked) }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>
                    {editingId ? t("services.saveChanges") : t("services.saveService")}
                  </Button>
                  {editingId ? (
                    <Button type="button" variant="outline" onClick={cancelEditing}>
                      {t("services.cancelEditing")}
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("services.serviceListTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!loading && !loadError && services.length === 0 ? (
                <EmptyState
                  className="mb-4"
                  icon={ClipboardList}
                  title={t("services.emptyStateTitle")}
                  description={t("services.emptyStateDescription")}
                  actionLabel={t("services.addServiceTitle")}
                  onAction={() => {
                    const el = document.getElementById("service-name")
                    el?.scrollIntoView({ behavior: "smooth", block: "center" })
                    window.setTimeout(() => el?.focus(), 300)
                  }}
                />
              ) : null}

              <ul className="space-y-2.5">
                {services.map((service) => (
                  <li key={service.id} className="rounded-xl border border-border/80 bg-card p-3">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{service.name}</p>
                        <span
                          className={cn(
                            "inline-flex w-fit",
                            semanticStatusBadgeClass(statusTone(service.isActive), undefined)
                          )}
                        >
                          {service.isActive ? t("services.activeStatus") : t("services.hiddenStatus")}
                        </span>
                        {service.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {service.durationMinutes} {t("services.min")} - {service.price} {t("services.zł")}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEditing(service)}>
                          <Pencil className="size-3.5" />
                          {t("services.edit")}
                        </Button>
                        {isSupabaseConfigured() && businessProfileId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setHoursService(service)
                              setHoursOpen(true)
                            }}
                          >
                            <Clock className="size-3.5" />
                            {t("services.serviceHours")}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setConfirmDeleteServiceId((prev) => (prev === service.id ? null : service.id))
                          }
                        >
                          <Trash2 className="size-3.5" />
                          {t("services.delete")}
                        </Button>
                      </div>
                    </div>

                    {confirmDeleteServiceId === service.id ? (
                      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-sm font-semibold text-foreground">{t("services.deleteConfirmTitle")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("services.deleteConfirmHint")}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteServiceId(null)}>
                            {t("services.cancel")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void removeServiceItem(service.id)}
                          >
                            {t("services.confirmDelete")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <ServiceHoursSheet
          open={hoursOpen}
          onOpenChange={setHoursOpen}
          service={hoursService}
          businessProfileId={businessProfileId}
          t={t}
          onSaved={() => {
            void refreshServices()
            setActionNotice(t("services.serviceHoursSaved"))
          }}
        />
      </PageShell>
    </AppShell>
  )
}
