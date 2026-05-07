"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import {
  getAvailabilityRules,
  getServiceAvailabilityRules,
  saveServiceAvailabilityRules,
} from "@/lib/availability/availability-store"
import { updateService } from "@/lib/services/services-store"
import type { ServiceAvailabilityRuleInput } from "@/lib/availability/availability-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Service } from "@/types/domain"

const WD_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
const WD_LABEL: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
}

type Row = {
  weekday: number
  isAvailable: boolean
  startTime: string
  endTime: string
}

type Translate = (key: string) => string

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
  businessProfileId: string | null
  t: Translate
  onSaved: () => void
}

function toMinutes(hm: string): number {
  const parts = hm.split(":").map((x) => Number(String(x).trim()))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return h * 60 + m
}

function formatDbTime(s: string): string {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

export function ServiceHoursSheet({
  open,
  onOpenChange,
  service,
  businessProfileId,
  t,
  onSaved,
}: Props) {
  const [useDefault, setUseDefault] = React.useState(true)
  const [rows, setRows] = React.useState<Row[]>([])
  const [companyRows, setCompanyRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    if (!service || !businessProfileId || !isSupabaseConfigured()) {
      setUseDefault(true)
      const fallbackRows = WD_ORDER.map((weekday) => ({
        weekday,
        isAvailable: weekday >= 1 && weekday <= 5,
        startTime: "09:00",
        endTime: "17:00",
      }))
      setRows(fallbackRows)
      setCompanyRows(fallbackRows)
      setLoading(false)
      return
    }
    const client = getBrowserClient()
    const [rules, businessRules] = await Promise.all([
      getServiceAvailabilityRules(client, businessProfileId, service.id),
      getAvailabilityRules(client, businessProfileId),
    ])
    const businessMapped = WD_ORDER.map((weekday) => {
      const day = businessRules.find((d) => d.weekday === weekday)
      return {
        weekday,
        isAvailable: day ? day.isOpen : weekday >= 1 && weekday <= 5,
        startTime: day ? formatDbTime(day.startTime) : "09:00",
        endTime: day ? formatDbTime(day.endTime) : "17:00",
      }
    })
    setCompanyRows(businessMapped)
    setUseDefault(rules.length === 0)
    const byWd = new Map(rules.map((r) => [r.weekday, r]))
    if (rules.length === 0) {
      setRows(businessMapped)
      setLoading(false)
      return
    }
    setRows(
      WD_ORDER.map((weekday) => {
        const r = byWd.get(weekday)
        if (!r) {
          return {
            weekday,
            isAvailable: false,
            startTime: "09:00",
            endTime: "17:00",
          }
        }
        return {
          weekday,
          isAvailable: r.is_available,
          startTime: formatDbTime(r.start_time),
          endTime: formatDbTime(r.end_time),
        }
      })
    )
    setLoading(false)
  }, [businessProfileId, service])

  React.useEffect(() => {
    if (!open || !service) return
    queueMicrotask(() => {
      void load()
    })
  }, [open, service, load])

  const updateRow = (weekday: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((x) => (x.weekday === weekday ? { ...x, ...patch } : x)))
  }

  const save = () => {
    void (async () => {
      if (!service || !businessProfileId) return
      setSaving(true)
      setError(false)
      const client = getBrowserClient()
      try {
        const u1 = await updateService(client, businessProfileId, service.id, {
          usesDefaultAvailability: useDefault,
        })
        if (!u1.ok) {
          setError(true)
          return
        }
        if (useDefault) {
          const r0 = await saveServiceAvailabilityRules(client, businessProfileId, service.id, [])
          if (!r0.ok) {
            setError(true)
            return
          }
        } else {
          const payload: ServiceAvailabilityRuleInput[] = []
          for (const r of rows) {
            if (toMinutes(r.endTime) <= toMinutes(r.startTime)) {
              setError(true)
              return
            }
            payload.push({
              weekday: r.weekday,
              isAvailable: r.isAvailable,
              startTime: r.startTime,
              endTime: r.endTime,
            })
          }
          const r2 = await saveServiceAvailabilityRules(client, businessProfileId, service.id, payload)
          if (!r2.ok) {
            setError(true)
            return
          }
        }
        onSaved()
        onOpenChange(false)
      } finally {
        setSaving(false)
      }
    })()
  }

  if (!service) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-border/80 bg-card p-0 sm:max-w-lg"
        showCloseButton
      >
        <SheetHeader className="space-y-1 border-b border-border/70 px-6 py-6 text-left">
          <SheetTitle className="flex items-center gap-2 font-heading text-xl">
            <Clock className="size-5 text-primary" aria-hidden />
            {t("services.serviceHoursTitle")}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{service.name}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="premium-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-6">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/15 px-3 py-2.5">
              <Label htmlFor="svc-use-default" className="text-sm">
                {t("services.useBusinessHours")}
              </Label>
              <Switch
                id="svc-use-default"
                checked={useDefault}
                onCheckedChange={(c) => {
                  const next = Boolean(c)
                  setUseDefault(next)
                  if (!next) {
                    setRows((prev) =>
                      prev.length === 0 || useDefault
                        ? companyRows.length > 0
                          ? companyRows
                          : prev
                        : prev
                    )
                  }
                }}
              />
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("services.loadingServiceHours")}</p>
            ) : null}
            {!loading && useDefault ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("services.usesBusinessHoursHint")}
              </p>
            ) : null}
            {!loading && !useDefault ? (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.weekday}
                    className="rounded-xl border border-border bg-muted/10 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {t(`availability.${WD_LABEL[row.weekday]}` as "availability.monday")}
                      </p>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.isAvailable}
                          onCheckedChange={(c) => updateRow(row.weekday, { isAvailable: Boolean(c) })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {row.isAvailable ? t("availability.open") : t("availability.closed")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">{t("availability.from")}</Label>
                        <Input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => updateRow(row.weekday, { startTime: e.target.value })}
                          disabled={!row.isAvailable}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("availability.to")}</Label>
                        <Input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => updateRow(row.weekday, { endTime: e.target.value })}
                          disabled={!row.isAvailable}
                          className="h-9"
                        />
                      </div>
                    </div>
                    {!row.isAvailable ? (
                      <p className="mt-2 text-xs text-muted-foreground">{t("availability.closed")}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {t("services.serviceHoursSaveError")}
              </p>
            ) : null}
          </div>
          <SheetFooter className="border-t border-border/70 px-6 py-4">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              {t("services.cancel")}
            </Button>
            <Button type="button" className="w-full sm:w-auto" disabled={saving} onClick={save}>
              {t("services.saveServiceHours")}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
