"use client"

import * as React from "react"
import {
  Check,
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { FormActions } from "@/components/shared/form-actions"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  buildPriorIdentity,
  isLikelyUuidClientId,
  loadClientsWorkspace,
  type ClientsLoadMode,
  persistClientsCatalog,
  persistClientUpdates,
  readStoredClientsCatalogSnapshot,
} from "@/lib/clients/clients-store"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { deleteClient, createClient } from "@/lib/supabase/repositories/clients.repository"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  buildStoredInternationalPhone,
  splitStoredPhoneIntoParts,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"
import type { Client } from "@/types/domain"

let localFallbackClientSeq = 0

function allocateLocalFallbackClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  localFallbackClientSeq += 1
  return `lc-${localFallbackClientSeq}`
}

function normalizeQuery(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

type FormState = {
  firstName: string
  lastName: string
  phoneDialCode: string
  phoneNational: string
  email: string
  notes: string
}

const emptyForm = (): FormState => ({
  firstName: "",
  lastName: "",
  phoneDialCode: "+48",
  phoneNational: "",
  email: "",
  notes: "",
})

function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim().replace(/\s+/g, " ")
  if (!normalized) return { firstName: "", lastName: "" }
  const parts = normalized.split(" ")
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  }
}

function joinPersonName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim().replace(/\s+/g, " ")
}

function isEmailFormatValid(email: string): boolean {
  const t = email.trim()
  if (!t) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

function stableClientRenderId(c: Client): string {
  const id = c.id.trim()
  if (id) return id
  const email = c.email.trim().toLowerCase()
  const phone = c.phone.replace(/\s+/g, "")
  const name = c.fullName.trim().toLowerCase().replace(/\s+/g, "-")
  return `client-${email || phone || name || "unknown"}`
}

function countCompletedClientVisits(c: Client): number {
  return c.visitHistory.filter((v) => v.status === "completed").length
}

function dedupeClientsForRender(rows: Client[]): Client[] {
  const byId = new Map<string, Client>()
  for (const row of rows) {
    const key = stableClientRenderId(row)
    const prev = byId.get(key)
    if (!prev) {
      byId.set(key, { ...row, id: key })
      continue
    }
    const visitHistoryMap = new Map<string, (typeof row.visitHistory)[number]>()
    for (const v of prev.visitHistory) {
      visitHistoryMap.set(`${v.id}|${v.startsAt}|${v.serviceLabel}|${v.status}`, v)
    }
    for (const v of row.visitHistory) {
      visitHistoryMap.set(`${v.id}|${v.startsAt}|${v.serviceLabel}|${v.status}`, v)
    }
    const mergedVisitHistory = Array.from(visitHistoryMap.values()).sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    )
    let mergedNoShow = 0
    let mergedConfirmed = 0
    let mergedCancelled = 0
    for (const h of mergedVisitHistory) {
      if (h.status === "no_show") mergedNoShow += 1
      if (h.status === "confirmed" || h.status === "completed") mergedConfirmed += 1
      if (h.status === "cancelled") mergedCancelled += 1
    }
    const mergedVisitCount = mergedVisitHistory.length
    byId.set(key, {
      ...row,
      id: key,
      fullName: row.fullName.trim() || prev.fullName.trim(),
      phone: row.phone.trim() || prev.phone.trim(),
      email: row.email.trim() || prev.email.trim(),
      notes: row.notes?.trim() || prev.notes?.trim() || undefined,
      visitCount: mergedVisitCount,
      confirmedVisitCount: mergedConfirmed,
      noShowCount: mergedNoShow,
      cancelledVisitCount: mergedCancelled,
      visitHistory: mergedVisitHistory,
    })
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "pl", { sensitivity: "base" })
  )
}

type SaveBanner = "added" | "edited" | null

type WorkspaceMeta = {
  mode: ClientsLoadMode
  businessProfileId: string | null
  businessSlug: string | null
}

export default function ClientsPage() {
  const { t, language } = useTranslations()
  const { ready: accessReady, businessId } = useBusinessAccess()
  const [clients, setClients] = React.useState<Client[]>(() => readStoredClientsCatalogSnapshot() ?? [])
  const [workspace, setWorkspace] = React.useState<WorkspaceMeta | null>(null)
  const [catalogLoading, setCatalogLoading] = React.useState(() => !readStoredClientsCatalogSnapshot()?.length)
  const [query, setQuery] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [detailsId, setDetailsId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [showSaved, setShowSaved] = React.useState<SaveBanner>(null)
  const [detailsEditing, setDetailsEditing] = React.useState(false)
  const [detailForm, setDetailForm] = React.useState<FormState>(emptyForm)
  const [detailFieldError, setDetailFieldError] = React.useState<string | null>(null)
  const [detailSaving, setDetailSaving] = React.useState(false)

  const dateTimeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language]
  )

  React.useEffect(() => {
    if (!showSaved) return
    const tid = window.setTimeout(() => setShowSaved(null), 4500)
    return () => window.clearTimeout(tid)
  }, [showSaved])

  const reloadCatalog = React.useCallback(() => {
    void (async () => {
      const w = await loadClientsWorkspace({ businessId: businessId ?? undefined })
      setClients(w.clients)
      setWorkspace({
        mode: w.mode,
        businessProfileId: w.businessProfileId,
        businessSlug: w.businessSlug,
      })
      setCatalogLoading(false)
    })()
  }, [businessId])

  React.useEffect(() => {
    if (!accessReady) return
    reloadCatalog()
  }, [accessReady, reloadCatalog])

  React.useEffect(() => {
    const onBookings = () => {
      void reloadCatalog()
    }
    window.addEventListener("pw-bookings", onBookings)
    return () => window.removeEventListener("pw-bookings", onBookings)
  }, [reloadCatalog])

  React.useEffect(() => {
    queueMicrotask(() => {
      setDetailsEditing(false)
      setDetailFieldError(null)
    })
  }, [detailsId])

  const uniqueClients = React.useMemo(() => dedupeClientsForRender(clients), [clients])

  const filtered = React.useMemo(() => {
    const q = normalizeQuery(query)
    if (!q) return uniqueClients
    return uniqueClients.filter((c) => {
      const phoneNorm = c.phone.replace(/\s/g, "").toLowerCase()
      const qPhone = q.replace(/\s/g, "")
      return (
        c.fullName.toLowerCase().includes(q) ||
        phoneNorm.includes(qPhone) ||
        c.email.toLowerCase().includes(q)
      )
    })
  }, [uniqueClients, query])

  const detailsClient = React.useMemo(
    () => (detailsId ? uniqueClients.find((c) => c.id === detailsId) ?? null : null),
    [uniqueClients, detailsId]
  )

  const openCreate = () => {
    setForm(emptyForm())
    setCreateOpen(true)
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = joinPersonName(form.firstName, form.lastName)
    const phone = buildStoredInternationalPhone(form.phoneDialCode, form.phoneNational).trim()
    const email = form.email.trim()
    if (!fullName) return
    if (!phone) return
    if (!validateNationalPhoneLength(form.phoneDialCode, form.phoneNational).ok) return
    if (!isEmailFormatValid(email)) return

    const sb = isSupabaseConfigured() ? getBrowserClient() : null
    const bid = workspace?.businessProfileId ?? null

    if (workspace?.mode === "supabase_clients" && sb && bid) {
      // IMPORTANT: create must not overwrite an existing client (no "find or create").
      const notesTrim = form.notes.trim()
      const created = await createClient(sb, {
        business_id: bid,
        full_name: fullName,
        phone: phone || "",
        email: email || "",
        notes: notesTrim.length > 0 ? notesTrim : null,
      })
      if (created.error || !created.data) return
      const w = await loadClientsWorkspace()
      queueMicrotask(() => {
        setClients(w.clients)
        setWorkspace({
          mode: w.mode,
          businessProfileId: w.businessProfileId,
          businessSlug: w.businessSlug,
        })
      })
      setCreateOpen(false)
      setShowSaved("added")
      return
    }

    const next: Client = {
      id: allocateLocalFallbackClientId(),
      fullName,
      phone,
      email,
      visitCount: 0,
      confirmedVisitCount: 0,
      noShowCount: 0,
      cancelledVisitCount: 0,
      notes: form.notes.trim() || undefined,
      riskScore: 24,
      riskTier: "low",
      visitHistory: [],
    }

    const merged = [next, ...clients]
    setClients(merged)
    if (workspace?.mode !== "supabase_clients") {
      persistClientsCatalog(merged)
    }
    setCreateOpen(false)
    setShowSaved("added")
  }

  const removeClientHandler = async (id: string) => {
    if (!window.confirm(t("clients.deleteConfirm"))) {
      return
    }

    const sb = isSupabaseConfigured() ? getBrowserClient() : null
    const bid = workspace?.businessProfileId ?? null

    if (workspace?.mode === "supabase_clients" && sb && bid && isLikelyUuidClientId(id)) {
      const del = await deleteClient(sb, bid, id, "clients_panel")
      if (del.error) return
      const w = await loadClientsWorkspace()
      queueMicrotask(() => {
        setClients(w.clients)
        setWorkspace({
          mode: w.mode,
          businessProfileId: w.businessProfileId,
          businessSlug: w.businessSlug,
        })
      })
      if (detailsId === id) setDetailsId(null)
      return
    }

    const merged = clients.filter((c) => c.id !== id)
    setClients(merged)
    if (workspace?.mode !== "supabase_clients") {
      persistClientsCatalog(merged)
    }
    if (detailsId === id) setDetailsId(null)
  }

  const startDetailsEdit = () => {
    if (!detailsClient) return
    const split = splitPersonName(detailsClient.fullName)
    const phoneParts = splitStoredPhoneIntoParts(detailsClient.phone)
    setDetailForm({
      firstName: split.firstName,
      lastName: split.lastName,
      phoneDialCode: phoneParts.dialCode,
      phoneNational: phoneParts.nationalDigits,
      email: detailsClient.email,
      notes: detailsClient.notes?.trim() ? detailsClient.notes : "",
    })
    setDetailFieldError(null)
    setDetailsEditing(true)
  }

  const cancelDetailsEdit = () => {
    setDetailsEditing(false)
    setDetailFieldError(null)
    if (detailsClient) {
      const split = splitPersonName(detailsClient.fullName)
      const phoneParts = splitStoredPhoneIntoParts(detailsClient.phone)
      setDetailForm({
        firstName: split.firstName,
        lastName: split.lastName,
        phoneDialCode: phoneParts.dialCode,
        phoneNational: phoneParts.nationalDigits,
        email: detailsClient.email,
        notes: detailsClient.notes?.trim() ? detailsClient.notes : "",
      })
    }
  }

  const submitDetailsEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailsClient || !workspace) return

    const fullName = joinPersonName(detailForm.firstName, detailForm.lastName)
    const phone = buildStoredInternationalPhone(detailForm.phoneDialCode, detailForm.phoneNational).trim()
    const email = detailForm.email.trim()

    if (!fullName) {
      setDetailFieldError(t("clients.validationFullName"))
      return
    }
    if (!phone) {
      setDetailFieldError(t("clients.validationPhoneRequired"))
      return
    }
    if (!validateNationalPhoneLength(detailForm.phoneDialCode, detailForm.phoneNational).ok) {
      setDetailFieldError(t("clients.validationPhoneInvalid"))
      return
    }
    if (!isEmailFormatValid(email)) {
      setDetailFieldError(t("clients.validationEmail"))
      return
    }

    setDetailFieldError(null)
    setDetailSaving(true)
    try {
      const prior = buildPriorIdentity(detailsClient)
      const res = await persistClientUpdates({
        mode: workspace.mode,
        clientId: detailsClient.id,
        prior,
        nextFields: {
          fullName,
          phone,
          email,
          notes: detailForm.notes,
        },
        businessProfileId: workspace.businessProfileId,
        businessSlugNormalized: workspace.businessSlug,
        currentList: clients,
      })
      if (!res.ok) {
        const details = res.errorMessage?.trim()
        setDetailFieldError(
          details
            ? `${t("clients.saveFailed")} Szczegóły: ${details}`
            : t("clients.saveFailed")
        )
        return
      }
      queueMicrotask(() => {
        setClients(res.clients)
        setDetailsEditing(false)
        setDetailFieldError(null)
        setDetailsId(null)
        setShowSaved("edited")
      })
    } catch (error) {
      const details = error instanceof Error ? error.message : null
      setDetailFieldError(
        details
          ? `${t("clients.saveFailed")} Szczegóły: ${details}`
          : t("clients.saveFailed")
      )
    } finally {
      setDetailSaving(false)
    }
  }

  const isGloballyEmpty = !catalogLoading && uniqueClients.length === 0
  const isSearchEmpty = !isGloballyEmpty && filtered.length === 0

  const totalClients = uniqueClients.length
  const noShowTotal = uniqueClients.reduce((sum, c) => sum + (c.noShowCount ?? 0), 0)
  const completedTotal = uniqueClients.reduce(
    (sum, c) => sum + countCompletedClientVisits(c),
    0
  )
  const cancelledTotal = uniqueClients.reduce(
    (sum, c) => sum + (c.cancelledVisitCount ?? 0),
    0
  )

  return (
    <AppShell
      title={t("navigation.clients")}
      pageDescription={t("clients.description")}
      primaryAction={
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1 text-sm"
          data-tour="clients-add"
          onClick={openCreate}
        >
          <Plus className="size-3.5" />
          {t("common.addClient")}
        </Button>
      }
    >
      <PageShell>
        {showSaved ? (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success-foreground shadow-sm shadow-slate-900/5"
          >
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            {showSaved === "added" ? t("clients.addedBanner") : t("clients.updatedBanner")}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("clients.clients")}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {totalClients}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">{t("clients.noShow")}</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {noShowTotal}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("clients.completed")}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {completedTotal}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("clients.cancelled")}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {cancelledTotal}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="relative mt-4 min-w-0">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("clients.searchPlaceholder")}
            className="h-11 rounded-2xl border border-border bg-card pl-11 text-sm shadow-sm shadow-slate-900/5"
            aria-label={t("clients.searchAria")}
          />
        </div>

        <div className="mt-5 min-w-0">
          {catalogLoading ? (
            <p className="text-sm text-muted-foreground">{t("clients.loadingClients")}</p>
          ) : isGloballyEmpty ? (
            <EmptyState
              icon={Users}
              title={t("clients.emptyTitle")}
              description={t("clients.emptySubtitle")}
              actionLabel={t("common.addClient")}
              onAction={openCreate}
            />
          ) : isSearchEmpty ? (
            <Card className="rounded-2xl border border-dashed border-border bg-card py-10 shadow-sm shadow-slate-900/5">
              <CardContent className="px-4 text-center text-sm text-muted-foreground">
                {t("clients.searchEmptyHint")}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="hidden">
                <Card className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] shadow-none">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="w-[26%] pl-4">{t("clients.tableClient")}</TableHead>
                        <TableHead className="w-[30%]">{t("clients.tableContact")}</TableHead>
                        <TableHead className="w-[20%]">{t("clients.tableLastVisits")}</TableHead>
                        <TableHead className="w-[24%] min-w-[5rem] pr-4 text-right">
                          {t("clients.moreButton")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer border-border/50 hover:bg-muted/30"
                          onClick={() => setDetailsId(row.id)}
                        >
                          <TableCell className="pl-4 font-medium text-foreground">
                            {row.fullName}
                          </TableCell>
                          <TableCell className="min-w-0">
                            <div className="flex flex-col gap-0.5 text-sm">
                              <span className="text-foreground">{row.phone}</span>
                              <span className="line-clamp-1 break-all text-xs text-muted-foreground">
                                {row.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium text-success">
                                {countCompletedClientVisits(row)}
                              </span>{" "}
                              {t("clients.completedShort")} · {row.noShowCount} {t("clients.noShow")} ·{" "}
                              {row.cancelledVisitCount} {t("clients.cancelledShort")}
                            </div>
                          </TableCell>
                          <TableCell
                            className="pr-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 rounded-lg border-border/60 bg-background/80 px-2.5 text-foreground hover:bg-muted/80"
                                onClick={() => setDetailsId(row.id)}
                              >
                                <Eye className="size-3.5" />
                                <span className="hidden xl:inline">{t("common.details")}</span>
                                <span className="xl:hidden">{t("clients.moreButton")}</span>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0 text-muted-foreground"
                                    aria-label={`${t("clients.moreAria")}: ${row.fullName}`}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => setDetailsId(row.id)}>
                                    <Eye className="size-4" />
                                    {t("common.details")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => removeClientHandler(row.id)}
                                  >
                                    <Trash2 className="size-4" />
                                    {t("clients.deleteClient")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              <ul className="flex min-w-0 flex-col gap-2.5">
                {filtered.map((row) => (
                  <li key={row.id} className="min-w-0">
                    <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
                      <CardContent className="px-4 py-3">
                        <div className="grid gap-3 md:grid-cols-[1.6fr_1.1fr_0.9fr_auto] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {row.fullName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{row.phone}</span>
                              {" · "}
                              <span className="break-all">{row.email}</span>
                            </p>
                            {row.notes ? (
                              <p className="mt-1 hidden max-w-[48rem] truncate text-xs text-muted-foreground lg:block">
                                {row.notes}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="tabular-nums">
                                <span className="font-semibold text-success">
                                  {countCompletedClientVisits(row)}
                                </span>{" "}
                                {t("clients.completedShort")}
                              </span>
                              <span className="tabular-nums">
                                <span className="font-semibold text-foreground">
                                  {row.noShowCount}
                                </span>{" "}
                                {t("clients.noShow")}
                              </span>
                              <span className="tabular-nums">
                                <span className="font-semibold text-foreground">
                                  {row.cancelledVisitCount}
                                </span>{" "}
                                {t("clients.cancelledShort")}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-xl"
                              onClick={() => setDetailsId(row.id)}
                            >
                              <Eye className="size-3.5" />
                              {t("common.details")}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground"
                                  aria-label={`${t("clients.moreAria")}: ${row.fullName}`}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => removeClientHandler(row.id)}
                                >
                                  <Trash2 className="size-4" />
                                  {t("clients.deleteClient")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </PageShell>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-border/80 bg-card p-0 sm:max-w-md"
          showCloseButton
        >
          <SheetHeader className="space-y-1 border-b border-border/70 px-6 py-6 text-left">
            <SheetTitle className="font-heading text-xl">{t("clients.sheetNewTitle")}</SheetTitle>
            <SheetDescription className="text-base">
              {t("clients.sheetNewDescription")}
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(e) => void submitCreate(e)}
            className="premium-scrollbar flex flex-1 flex-col overflow-y-auto"
          >
            <div className="flex-1 space-y-5 px-6 py-6">
              <div className="space-y-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("team.firstName")}</Label>
                    <Input
                      id="firstName"
                      required
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder={language === "en" ? "First name" : "Imię"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("team.lastName")}</Label>
                    <Input
                      id="lastName"
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder={language === "en" ? "Last name" : "Nazwisko"}
                    />
                  </div>
                </div>
              </div>
              <InternationalPhoneFieldGroup
                label={t("clients.fieldPhoneShort")}
                dialCode={form.phoneDialCode}
                nationalDigits={form.phoneNational}
                onDialCodeChange={(v) => setForm((f) => ({ ...f, phoneDialCode: v }))}
                onNationalChange={(digits) =>
                  setForm((f) => ({ ...f, phoneNational: digits }))
                }
                dialSelectId="client-phone-dial"
                nationalInputId="client-phone-national"
              />
              <div className="space-y-2">
                <Label htmlFor="client-email">{t("clients.fieldEmailShort")}</Label>
                <Input
                  id="client-email"
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jan@firma.pl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-notes">{t("clients.fieldNotesShort")}</Label>
                <Textarea
                  id="client-notes"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t("clients.notesPlaceholderUi")}
                  className="resize-none"
                />
              </div>
            </div>
            <SheetFooter className="mt-auto border-t border-border/70 bg-muted/20 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <FormActions
                cancelLabel={t("messages.cancel")}
                submitLabel={t("clients.saveClientSubmit")}
                onCancel={() => setCreateOpen(false)}
              />
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <DialogPrimitive.Root
        open={Boolean(detailsClient)}
        onOpenChange={(o) => {
          if (!o) {
            setDetailsId(null)
            setDetailsEditing(false)
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(92vh,52rem)] w-[min(96vw,68rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-4 top-4 z-10"
                aria-label={language === "en" ? "Close" : "Zamknij"}
              >
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          {detailsClient ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <SheetHeader className="space-y-3 border-b border-border/70 px-6 py-6 text-left">
                <div className="min-w-0 space-y-1 pr-10">
                  {!detailsEditing ? (
                    <SheetTitle className="font-heading text-xl leading-snug">
                      {detailsClient.fullName}
                    </SheetTitle>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="detail-firstName">{t("team.firstName")}</Label>
                          <Input
                            id="detail-firstName"
                            autoComplete="given-name"
                            required
                            className="h-11 rounded-xl text-base"
                            value={detailForm.firstName}
                            onChange={(e) =>
                              setDetailForm((prev) => ({ ...prev, firstName: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="detail-lastName">{t("team.lastName")}</Label>
                          <Input
                            id="detail-lastName"
                            autoComplete="family-name"
                            className="h-11 rounded-xl text-base"
                            value={detailForm.lastName}
                            onChange={(e) =>
                              setDetailForm((prev) => ({ ...prev, lastName: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <SheetDescription className="text-base">
                    {t("clients.detailsSubtitle")}
                  </SheetDescription>
                </div>
              </SheetHeader>

              <div className="premium-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-6">
                {detailsEditing ? (
                  <form
                    id="client-details-edit-form"
                    className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start"
                    onSubmit={(e) => void submitDetailsEdit(e)}
                  >
                    <div className="space-y-6">
                      <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("clients.sectionContactHead")}
                        </h3>
                        <div className="min-w-0 space-y-4 rounded-xl border border-border/80 bg-muted/15 px-4 py-4">
                          <InternationalPhoneFieldGroup
                            label={t("clients.fieldPhoneShort")}
                            dialCode={detailForm.phoneDialCode}
                            nationalDigits={detailForm.phoneNational}
                            onDialCodeChange={(v) =>
                              setDetailForm((prev) => ({ ...prev, phoneDialCode: v }))
                            }
                            onNationalChange={(digits) =>
                              setDetailForm((prev) => ({ ...prev, phoneNational: digits }))
                            }
                            dialSelectId="detail-phone-dial"
                            nationalInputId="detail-phone-national"
                          />
                          <div className="space-y-2">
                            <Label htmlFor="detail-email">{t("clients.fieldEmailShort")}</Label>
                            <Input
                              id="detail-email"
                              type="email"
                              autoComplete="email"
                              className="h-11 rounded-xl"
                              value={detailForm.email}
                              onChange={(e) =>
                                setDetailForm((prev) => ({ ...prev, email: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("clients.sectionNotesHead")}
                        </h3>
                        <Textarea
                          id="detail-notes"
                          rows={4}
                          value={detailForm.notes}
                          onChange={(e) =>
                            setDetailForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          placeholder={t("clients.notesPlaceholderUi")}
                          className="min-h-[140px] resize-none rounded-xl"
                        />
                      </section>
                    </div>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("clients.sectionVisitsHead")}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {detailsClient.visitHistory.length}{" "}
                          {detailsClient.visitHistory.length === 1
                            ? t("clients.visitsEntryOne")
                            : t("clients.visitsEntryMany")}
                        </span>
                      </div>
                      {detailsClient.visitHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("clients.noVisitHistoryUi")}</p>
                      ) : (
                        <ul className="space-y-3">
                          {[...detailsClient.visitHistory]
                            .sort(
                              (a, b) =>
                                new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
                            )
                            .map((v) => (
                              <li
                                key={v.id}
                                className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground">{v.serviceLabel}</p>
                                  <StatusBadge status={v.status} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {dateTimeFmt.format(new Date(v.startsAt))}
                                </p>
                              </li>
                            ))}
                        </ul>
                      )}
                    </section>
                  </form>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
                    <div className="space-y-6">
                      <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("clients.sectionContactHead")}
                        </h3>
                        <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-4 text-sm">
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                {t("clients.fieldFullName")}
                              </p>
                              <p className="mt-0.5 text-foreground">
                                {detailsClient.fullName.trim() || "Brak imienia i nazwiska"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                {t("clients.fieldPhoneShort")}
                              </p>
                              <p className="mt-0.5 break-all text-foreground">
                                {detailsClient.phone.trim() || "Brak telefonu"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                {t("clients.fieldEmailShort")}
                              </p>
                              <p className="mt-0.5 break-all text-foreground">
                                {detailsClient.email.trim() || "Brak e-maila"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("clients.sectionNotesHead")}
                        </h3>
                        <p className="rounded-xl border border-border/80 bg-card px-4 py-4 text-sm leading-relaxed text-foreground">
                          {detailsClient.notes?.trim() ? detailsClient.notes : t("clients.noNotesText")}
                        </p>
                      </section>
                    </div>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("clients.sectionVisitsHead")}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {detailsClient.visitHistory.length}{" "}
                          {detailsClient.visitHistory.length === 1
                            ? t("clients.visitsEntryOne")
                            : t("clients.visitsEntryMany")}
                        </span>
                      </div>
                      {detailsClient.visitHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("clients.noVisitHistoryUi")}</p>
                      ) : (
                        <ul className="space-y-3">
                          {[...detailsClient.visitHistory]
                            .sort(
                              (a, b) =>
                                new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
                            )
                            .map((v) => (
                              <li
                                key={v.id}
                                className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground">{v.serviceLabel}</p>
                                  <StatusBadge status={v.status} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {dateTimeFmt.format(new Date(v.startsAt))}
                                </p>
                              </li>
                            ))}
                        </ul>
                      )}
                    </section>
                  </div>
                )}
              </div>
              <SheetFooter className="mt-auto flex w-full shrink-0 flex-col gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-col">
                {detailsEditing ? (
                  <>
                    {detailFieldError ? (
                      <p className="w-full text-sm text-destructive" role="alert">
                        {detailFieldError}
                      </p>
                    ) : null}
                    <Button
                      type="submit"
                      form="client-details-edit-form"
                      className="h-11 w-full rounded-xl"
                      disabled={detailSaving}
                    >
                      {t("common.saveChanges")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl"
                      disabled={detailSaving}
                      onClick={cancelDetailsEdit}
                    >
                      {t("messages.cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl"
                      onClick={startDetailsEdit}
                    >
                      {t("clients.editClient")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11 w-full rounded-xl"
                      onClick={() => removeClientHandler(detailsClient.id)}
                    >
                      <Trash2 className="size-4" />
                      {t("clients.deleteClient")}
                    </Button>
                  </>
                )}
              </SheetFooter>
            </div>
          ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AppShell>
  )
}
