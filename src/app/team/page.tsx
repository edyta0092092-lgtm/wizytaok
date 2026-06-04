"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Copy, Trash2 } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { AccessDenied } from "@/components/shared/access-denied"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { Badge } from "@/components/ui/badge"
import { AppDatePicker } from "@/components/ui/app-date-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PanelRole } from "@/lib/auth/permissions"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { syncBusinessMemberRoleForStaff } from "@/lib/team/apply-staff-panel-access"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getLocalServices, getServices } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import {
  addStaffMember,
  deleteStaffMember,
  getStaffAvailabilityContextForBusiness,
  getStaffMembers,
  getStaffServiceIds,
  normalizeStaffRole,
  normalizeStaffAvailabilityRulesForEditor,
  saveStaffAvailabilityExceptions,
  saveStaffAvailabilityRules,
  type StaffAvailabilityExceptionInput,
  updateStaffMember,
  type StaffAvailabilityRuleInput,
} from "@/lib/staff/staff-store"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import type { Service, StaffMember } from "@/types/domain"
import {
  buildStoredInternationalPhone,
  splitStoredPhoneIntoParts,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FormState = {
  firstName: string
  lastName: string
  email: string
  phoneDialCode: string
  phoneNational: string
  isActive: boolean
  serviceIds: string[]
  useBusinessHours: boolean
  rules: StaffAvailabilityRuleInput[]
  exceptions: StaffAvailabilityExceptionInput[]
  panelMemberRole: PanelRole
}

type SavedProfileSnapshot = Pick<
  FormState,
  "firstName" | "lastName" | "email" | "phoneDialCode" | "phoneNational" | "isActive" | "panelMemberRole"
>

type PolishHoliday = {
  date: string
  namePl: string
  nameEn: string
}

type CalendarExceptionType = "day_off" | "special_hours"

type CalendarDayInfo = {
  date: string
  exceptions: StaffAvailabilityExceptionInput[]
  types: Set<CalendarExceptionType>
}

type ExceptionPreviewGroup = {
  type: "time_off_group" | "special_hours"
  startDate: string
  endDate: string
  note: string | null
  originalItems: StaffAvailabilityExceptionInput[]
  specialHours?: { startTime: string; endTime: string }
}

function emptyForm(): FormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phoneDialCode: "+48",
    phoneNational: "",
    isActive: true,
    serviceIds: [],
    useBusinessHours: true,
    rules: WEEKDAYS.map((weekday) => ({
      weekday,
      isAvailable: weekday >= 1 && weekday <= 5,
      startTime: "09:00",
      endTime: "17:00",
    })),
    exceptions: [],
    panelMemberRole: "staff",
  }
}

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

function toMinutes(hm: string): number {
  const [h = "0", m = "0"] = hm.split(":")
  return Number(h) * 60 + Number(m)
}

function isScheduleTimeRangeValid(startTime: string, endTime: string): boolean {
  const start = startTime.trim()
  const end = endTime.trim()
  if (!start || !end) return false
  return toMinutes(end) > toMinutes(start)
}

function findInvalidScheduleRule(rules: StaffAvailabilityRuleInput[]): StaffAvailabilityRuleInput | null {
  for (const rule of rules) {
    if (!rule.isAvailable) continue
    if (!isScheduleTimeRangeValid(rule.startTime, rule.endTime)) return rule
  }
  return null
}

function weekdayLabelKey(weekday: number): string {
  const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const
  return `availability.${keys[weekday] ?? "monday"}`
}

function weekdayShortLabel(t: (key: string) => string, weekday: number): string {
  return t(weekdayLabelKey(weekday)).slice(0, 3)
}

function sortRulesByUiWeekdayOrder(rules: StaffAvailabilityRuleInput[]): StaffAvailabilityRuleInput[] {
  const order = new Map<number, number>([
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 5],
    [0, 6],
  ])
  return [...rules].sort((a, b) => {
    const ai = order.get(a.weekday) ?? 99
    const bi = order.get(b.weekday) ?? 99
    return ai - bi
  })
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function normalizeExceptionRange(ex: StaffAvailabilityExceptionInput): { from: string; to: string } | null {
  const from = ex.exceptionDate.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null
  const toRaw = (ex.exceptionEndDate ?? "").trim().slice(0, 10)
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : from
  if (to < from) return null
  return { from, to }
}

/** Zmiana „Data od”: domyślnie wyrównaj „Data do” do tej samej wartości (jeden dzień), chyba że użytkownik ma już dłuższy zakres. */
function patchStaffExceptionOnFromChange(
  ex: StaffAvailabilityExceptionInput,
  newFrom: string,
): Partial<StaffAvailabilityExceptionInput> {
  const iso = newFrom.trim().slice(0, 10)
  const endRaw = (ex.exceptionEndDate ?? "").trim().slice(0, 10)
  const patch: Partial<StaffAvailabilityExceptionInput> = { exceptionDate: iso }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endRaw)) {
    patch.exceptionEndDate = iso
    return patch
  }
  if (endRaw < iso) {
    patch.exceptionEndDate = iso
    return patch
  }
  return patch
}

function expandIsoDateRange(from: string, to: string): string[] {
  const [sy, sm, sd] = from.split("-").map(Number)
  const [ey, em, ed] = to.split("-").map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []
  const out: string[] = []
  const d = new Date(start)
  while (d <= end) {
    out.push(toIsoDateLocal(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Rozwija każdy wyjątek (z opcjonalnym exceptionEndDate) na jeden wiersz na dzień — ta sama logika co kalendarz. */
function expandStaffExceptionsToDayRows(exceptions: StaffAvailabilityExceptionInput[]): StaffAvailabilityExceptionInput[] {
  const byDate = new Map<string, StaffAvailabilityExceptionInput>()
  for (const ex of exceptions) {
    const range = normalizeExceptionRange(ex)
    if (!range) continue
    const dates = expandIsoDateRange(range.from, range.to)
    for (const date of dates) {
      byDate.set(date, {
        ...ex,
        exceptionDate: date,
        exceptionEndDate: date,
      })
    }
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row)
}

type MergedStaffExceptionSlice = {
  startDate: string
  endDate: string
  isClosed: boolean
  startTime: string
  endTime: string
  reason: string
}

/**
 * Łączy kolejne dni z tą samą konfiguracją (typ, godziny, notatka) — wspólna logika zapisu i podglądu.
 */
function mergeContiguousStaffExceptionDays(dayRows: StaffAvailabilityExceptionInput[]): MergedStaffExceptionSlice[] {
  const parsed = dayRows
    .map((ex) => {
      const date = ex.exceptionDate.trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
      const isClosed = Boolean(ex.isClosed)
      const startTime = isClosed ? "09:00" : ex.startTime.trim()
      const endTime = isClosed ? "17:00" : ex.endTime.trim()
      const reason = (ex.reason ?? "").trim()
      return { date, isClosed, startTime, endTime, reason }
    })
    .filter(
      (
        row,
      ): row is {
        date: string
        isClosed: boolean
        startTime: string
        endTime: string
        reason: string
      } => Boolean(row),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  const grouped: MergedStaffExceptionSlice[] = []
  let i = 0
  while (i < parsed.length) {
    const current = parsed[i]
    let endDate = current.date
    let j = i + 1
    while (j < parsed.length) {
      const next = parsed[j]
      const [yy, mm, dd] = endDate.split("-").map(Number)
      const nextExpected = new Date(yy, mm - 1, dd)
      nextExpected.setDate(nextExpected.getDate() + 1)
      const nextExpectedIso = toIsoDateLocal(nextExpected)
      const hasSameConfig =
        next.isClosed === current.isClosed &&
        next.startTime === current.startTime &&
        next.endTime === current.endTime &&
        next.reason === current.reason
      if (!hasSameConfig || next.date !== nextExpectedIso) break
      endDate = next.date
      j += 1
    }
    grouped.push({
      startDate: current.date,
      endDate,
      isClosed: current.isClosed,
      startTime: current.startTime || "09:00",
      endTime: current.endTime || "17:00",
      reason: current.reason,
    })
    i = j
  }
  return grouped
}

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function getPolishHolidays(year: number): PolishHoliday[] {
  const fixed: PolishHoliday[] = [
    { date: `${year}-01-01`, namePl: "Nowy Rok", nameEn: "New Year's Day" },
    { date: `${year}-01-06`, namePl: "Święto Trzech Króli", nameEn: "Epiphany" },
    { date: `${year}-05-01`, namePl: "Święto Pracy", nameEn: "Labour Day" },
    { date: `${year}-05-03`, namePl: "Święto Konstytucji 3 Maja", nameEn: "Constitution Day" },
    { date: `${year}-08-15`, namePl: "Wniebowzięcie Najświętszej Maryi Panny", nameEn: "Assumption of Mary" },
    { date: `${year}-11-01`, namePl: "Wszystkich Świętych", nameEn: "All Saints' Day" },
    { date: `${year}-11-11`, namePl: "Narodowe Święto Niepodległości", nameEn: "Independence Day" },
    { date: `${year}-12-25`, namePl: "Boże Narodzenie (pierwszy dzień)", nameEn: "Christmas Day" },
    { date: `${year}-12-26`, namePl: "Boże Narodzenie (drugi dzień)", nameEn: "Second Day of Christmas" },
  ]
  const easter = easterSunday(year)
  const easterMonday = new Date(easter)
  easterMonday.setDate(easterMonday.getDate() + 1)
  const pentecost = new Date(easter)
  pentecost.setDate(pentecost.getDate() + 49)
  const corpusChristi = new Date(easter)
  corpusChristi.setDate(corpusChristi.getDate() + 60)
  const movable: PolishHoliday[] = [
    { date: toIsoDateLocal(easter), namePl: "Wielkanoc", nameEn: "Easter Sunday" },
    { date: toIsoDateLocal(easterMonday), namePl: "Poniedziałek Wielkanocny", nameEn: "Easter Monday" },
    { date: toIsoDateLocal(pentecost), namePl: "Zesłanie Ducha Świętego", nameEn: "Pentecost" },
    { date: toIsoDateLocal(corpusChristi), namePl: "Boże Ciało", nameEn: "Corpus Christi" },
  ]
  return [...fixed, ...movable]
}

function groupStaffExceptionsForPreview(exceptions: StaffAvailabilityExceptionInput[]): ExceptionPreviewGroup[] {
  const expanded = expandStaffExceptionsToDayRows(exceptions)
  return mergeContiguousStaffExceptionDays(expanded).map((s) => ({
    type: s.isClosed ? "time_off_group" : "special_hours",
    startDate: s.startDate,
    endDate: s.endDate,
    note: s.reason.length > 0 ? s.reason : null,
    originalItems: [
      {
        exceptionDate: s.startDate,
        exceptionEndDate: s.endDate,
        isClosed: s.isClosed,
        startTime: s.startTime,
        endTime: s.endTime,
        reason: s.reason,
      },
    ],
    ...(s.isClosed ? {} : { specialHours: { startTime: s.startTime, endTime: s.endTime } }),
  }))
}

function groupExceptionsForEditing(exceptions: StaffAvailabilityExceptionInput[]): StaffAvailabilityExceptionInput[] {
  const expanded = expandStaffExceptionsToDayRows(exceptions)
  return mergeContiguousStaffExceptionDays(expanded).map((s) => ({
    exceptionDate: s.startDate,
    exceptionEndDate: s.endDate,
    isClosed: s.isClosed,
    startTime: s.startTime || "09:00",
    endTime: s.endTime || "17:00",
    reason: s.reason,
  }))
}

type PanelInviteRow = {
  id: string
  email: string
  status: string
  token: string
  created_at: string
  staff_member_id: string | null
  role: string
}

export default function TeamPage() {
  const { t, language } = useTranslations()
  const access = useBusinessAccess()
  const { flowActive, activeStepId } = useOnboarding()
  const [items, setItems] = React.useState<StaffMember[]>([])
  const [services, setServices] = React.useState<Service[]>([])
  const [businessProfileId, setBusinessProfileId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [staffLoadError, setStaffLoadError] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [noticeDetail, setNoticeDetail] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<StaffMember | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [panelInvites, setPanelInvites] = React.useState<PanelInviteRow[]>([])
  const [serviceIdsByStaff, setServiceIdsByStaff] = React.useState<Record<string, string[]>>({})
  const [inviteHighlightId, setInviteHighlightId] = React.useState<string | null>(null)
  const [isScheduleEditing, setIsScheduleEditing] = React.useState(false)
  const [isExceptionsEditing, setIsExceptionsEditing] = React.useState(false)
  /** Gdy false przy dodawaniu osoby — zwinięty podgląd wyjątków (jak po „Zapisz wyjątek”). */
  const [isNewStaffExceptionsExpanded, setIsNewStaffExceptionsExpanded] = React.useState(true)
  const [savedScheduleState, setSavedScheduleState] = React.useState<{
    useBusinessHours: boolean
    rules: StaffAvailabilityRuleInput[]
  }>({
    useBusinessHours: true,
    rules: emptyForm().rules,
  })
  const [savedExceptionsState, setSavedExceptionsState] = React.useState<StaffAvailabilityExceptionInput[]>([])
  const [savedProfileState, setSavedProfileState] = React.useState<SavedProfileSnapshot>({
    firstName: "",
    lastName: "",
    email: "",
    phoneDialCode: "+48",
    phoneNational: "",
    isActive: true,
    panelMemberRole: "staff",
  })
  const [savedServiceIds, setSavedServiceIds] = React.useState<string[]>([])
  const [sidebarTab, setSidebarTab] = React.useState<"members" | "invites">("members")
  const [formTab, setFormTab] = React.useState<
    "profile" | "panel" | "services" | "schedule" | "exceptions"
  >("profile")
  const [staffQuery, setStaffQuery] = React.useState("")
  const isStaffServiceOnboarding = flowActive && activeStepId === "staff_service"
  const staffServiceTourNeedsPerson = isStaffServiceOnboarding && !editing
  const staffServiceTourNeedsServicesTab =
    isStaffServiceOnboarding && Boolean(editing) && formTab !== "services"
  const staffServiceTourNeedsServiceChoice =
    isStaffServiceOnboarding && Boolean(editing) && formTab === "services"

  const dateTimeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [language],
  )

  const exceptionDateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-GB" : "pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [language],
  )

  const formatExceptionPreviewDate = React.useCallback(
    (raw: string) => {
      const d = raw.trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return raw || "-"
      const [y, m, day] = d.split("-").map(Number)
      const dt = new Date(y, m - 1, day)
      return exceptionDateFmt.format(dt)
    },
    [exceptionDateFmt],
  )

  const [calendarMonth, setCalendarMonth] = React.useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedCalendarDate, setSelectedCalendarDate] = React.useState<string | null>(null)

  const monthLabelFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        month: "long",
        year: "numeric",
      }),
    [language],
  )

  const formatPrice = React.useCallback(
    (s: Service) =>
      new Intl.NumberFormat(language === "en" ? "en-US" : "pl-PL", {
        style: "currency",
        currency: s.currency?.trim() || "PLN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(s.price),
    [language],
  )

  const calendarExceptionsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarDayInfo>()
    for (const ex of form.exceptions) {
      const range = normalizeExceptionRange(ex)
      if (!range) continue
      const dates = expandIsoDateRange(range.from, range.to)
      for (const date of dates) {
        const current = map.get(date) ?? {
          date,
          exceptions: [],
          types: new Set<CalendarExceptionType>(),
        }
        current.exceptions.push({
          ...ex,
          exceptionDate: date,
          exceptionEndDate: date,
        })
        current.types.add(ex.isClosed ? "day_off" : "special_hours")
        map.set(date, current)
      }
    }
    return map
  }, [form.exceptions])

  const calendarHolidaysByDay = React.useMemo(() => {
    const y = calendarMonth.getFullYear()
    const holidays = [...getPolishHolidays(y), ...getPolishHolidays(y - 1), ...getPolishHolidays(y + 1)]
    const map = new Map<string, PolishHoliday>()
    for (const h of holidays) map.set(h.date, h)
    return map
  }, [calendarMonth])

  const groupedExceptionPreview = React.useMemo(
    () => groupStaffExceptionsForPreview(form.exceptions),
    [form.exceptions],
  )

  const refetchStaffMembers = React.useCallback(
    async (client: ReturnType<typeof getBrowserClient>, bid: string | null) => {
      const rows = await getStaffMembers(client, bid)
      setItems(rows)
      return rows
    },
    [],
  )

  React.useEffect(() => {
    if (access.businessId) {
      queueMicrotask(() => setBusinessProfileId(access.businessId))
    }
  }, [access.businessId])

  const load = React.useCallback(async () => {
    const client = getBrowserClient()
    const bid = access.businessId ?? businessProfileId ?? null
    if (bid) setBusinessProfileId(bid)
    let svc: Service[] = []
    try {
      svc = await getServices(client, bid)
    } catch {
      svc = client && bid && isSupabaseConfigured() ? [] : getLocalServices()
    }
    const rows = await refetchStaffMembers(client, bid)
    setStaffLoadError(false)
    setServices(svc)

    const currentStaffIds = new Set(rows.map((x) => x.id))
    const nextMap: Record<string, string[]> = {}
    if (client && bid) {
      const ssRes = await client.from("staff_services").select("*").eq("business_id", bid)
      let staffServiceRows = (ssRes.data as Array<Record<string, unknown>> | null) ?? []
      if (
        ssRes.error &&
        ssRes.error.message.toLowerCase().includes("staff_services.business_id") &&
        ssRes.error.message.toLowerCase().includes("does not exist")
      ) {
        const fallbackSsRes = await client.from("staff_services").select("*")
        staffServiceRows = (fallbackSsRes.data as Array<Record<string, unknown>> | null) ?? []
      }
      for (const row of staffServiceRows) {
        const sid =
          (typeof row.staff_id === "string" && row.staff_id) ||
          (typeof row.staff_member_id === "string" && row.staff_member_id) ||
          ""
        const serviceIdRaw = row.service_id
        const serviceId =
          typeof serviceIdRaw === "string"
            ? serviceIdRaw
            : serviceIdRaw != null
              ? String(serviceIdRaw)
              : ""
        if (!sid) continue
        if (!currentStaffIds.has(sid)) continue
        if (!serviceId) continue
        const arr = nextMap[sid] ?? []
        arr.push(serviceId)
        nextMap[sid] = arr
      }
    }
    setServiceIdsByStaff(nextMap)

    if (bid && access.canManageInvitations && isSupabaseConfigured()) {
      try {
        const invApiRes = await fetch("/api/team/invitations", { cache: "no-store" })
        const invApiJson = (await invApiRes.json().catch(() => null)) as {
          ok?: boolean
          rows?: PanelInviteRow[]
        } | null
        if (invApiJson?.ok && Array.isArray(invApiJson.rows)) {
          setPanelInvites(invApiJson.rows)
        } else if (client) {
          const invRes = await client
            .from("business_invitations")
            .select("id,email,status,token,created_at,staff_member_id,role")
            .eq("business_id", bid)
            .order("created_at", { ascending: false })
          setPanelInvites((invRes.data as PanelInviteRow[] | null) ?? [])
        } else {
          setPanelInvites([])
        }
      } catch {
        if (client) {
          const invRes = await client
            .from("business_invitations")
            .select("id,email,status,token,created_at,staff_member_id,role")
            .eq("business_id", bid)
            .order("created_at", { ascending: false })
          setPanelInvites((invRes.data as PanelInviteRow[] | null) ?? [])
        } else {
          setPanelInvites([])
        }
      }
    } else {
      setPanelInvites([])
    }
    if (rows.length === 0 && bid) {
      setStaffLoadError(false)
    }
  }, [access.businessId, access.canManageInvitations, businessProfileId, refetchStaffMembers])

  const teamLoadedRef = React.useRef(false)

  React.useEffect(() => {
    if (!access.ready) return
    let cancelled = false
    void (async () => {
      const showBlocking = !teamLoadedRef.current
      if (showBlocking) setLoading(true)
      try {
        await load()
        if (!cancelled) teamLoadedRef.current = true
      } catch {
        if (!cancelled) {
          setStaffLoadError(true)
          setNotice(t("team.saveError"))
        }
      } finally {
        if (!cancelled && showBlocking) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access.ready, load, t])

  React.useEffect(() => {
    if (!notice) return
    const tid = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(tid)
  }, [notice])

  React.useEffect(() => {
    if (!noticeDetail) return
    const tid = window.setTimeout(() => setNoticeDetail(null), 6000)
    return () => window.clearTimeout(tid)
  }, [noticeDetail])

  React.useEffect(() => {
    if (!inviteHighlightId) return
    const tid = window.setTimeout(() => setInviteHighlightId(null), 12000)
    return () => window.clearTimeout(tid)
  }, [inviteHighlightId])

  const resetFormToCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setInviteHighlightId(null)
    setIsScheduleEditing(false)
    setIsExceptionsEditing(false)
    setIsNewStaffExceptionsExpanded(true)
  }

  const buildFormFromSavedSnapshot = React.useCallback((): FormState => {
    return {
      ...emptyForm(),
      ...savedProfileState,
      serviceIds: [...savedServiceIds],
      useBusinessHours: savedScheduleState.useBusinessHours,
      rules: savedScheduleState.rules.map((r) => ({ ...r })),
      exceptions: savedExceptionsState.map((ex) => ({ ...ex })),
    }
  }, [savedProfileState, savedServiceIds, savedScheduleState, savedExceptionsState])

  const restoreFormFromSavedSnapshot = React.useCallback(() => {
    setForm(buildFormFromSavedSnapshot())
  }, [buildFormFromSavedSnapshot])

  const handleGlobalCancelChanges = () => {
    if (editing?.id) {
      restoreFormFromSavedSnapshot()
      setIsScheduleEditing(false)
      setIsExceptionsEditing(false)
    } else {
      restoreFormFromSavedSnapshot()
      setIsScheduleEditing(false)
      setIsExceptionsEditing(false)
    }
    setIsNewStaffExceptionsExpanded(true)
    setNotice(t("team.changesReverted"))
    setNoticeDetail(null)
  }

  // No global "finish editing" action in this simplified UX.

  /**
   * Wczytuje pełny stan formularza z Supabase (ta sama ścieżka co „Edytuj osobę”).
   * @param resetInviteHighlight jak true, znosi podświetlenie zaproszenia (standardowe otwarcie edycji z listy)
   */
  const loadStaffMemberIntoForm = async (staff: StaffMember, resetInviteHighlight = true) => {
    if (resetInviteHighlight) setInviteHighlightId(null)
    setIsScheduleEditing(false)
    setIsExceptionsEditing(false)
    setEditing(staff)
    const client = getBrowserClient()
    const bid = businessProfileId ?? access.businessId ?? null
    try {
      setServices(await getServices(client, bid))
    } catch {
      setServices(client && bid && isSupabaseConfigured() ? [] : getLocalServices())
    }
    const [{ rules, exceptions }, serviceIds] = await Promise.all([
      getStaffAvailabilityContextForBusiness(client, bid, staff.id),
      getStaffServiceIds(client, bid, staff.id),
    ])
    let panelMemberRole: PanelRole = normalizeStaffRole(staff.role)
    if (client && bid) {
      const { data: mem } = await client
        .from("business_members")
        .select("email, role")
        .eq("business_id", bid)
        .eq("staff_member_id", staff.id)
        .maybeSingle()
      if (mem) {
        panelMemberRole = mem.role === "admin" ? "admin" : "staff"
      } else {
        const { data: inv } = await client
          .from("business_invitations")
          .select("email, role")
          .eq("business_id", bid)
          .eq("staff_member_id", staff.id)
          .eq("status", "pending")
          .maybeSingle()
        if (inv) {
          panelMemberRole = inv.role === "admin" ? "admin" : "staff"
        }
      }
    }
    const groupedExceptionsForEditing = groupExceptionsForEditing(
      exceptions.map((ex) => ({
        exceptionDate: ex.exceptionDate,
        exceptionEndDate: ex.exceptionDate,
        isClosed: ex.isUnavailable,
        startTime: ex.startTime ?? "09:00",
        endTime: ex.endTime ?? "17:00",
        reason: ex.reason ?? "",
      })),
    )
    const splitName = splitPersonName(staff.name)
    const phoneParts = splitStoredPhoneIntoParts(staff.phone ?? "")
    const normalizedRules =
      rules.length > 0 ? normalizeStaffAvailabilityRulesForEditor(rules) : emptyForm().rules
    setForm({
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      email: staff.email ?? "",
      phoneDialCode: phoneParts.dialCode,
      phoneNational: phoneParts.nationalDigits,
      isActive: staff.isActive,
      serviceIds,
      useBusinessHours: rules.length === 0,
      rules: sortRulesByUiWeekdayOrder(normalizedRules),
      exceptions: groupedExceptionsForEditing.map((ex) => ({ ...ex })),
      panelMemberRole,
    })
    setSavedScheduleState({
      useBusinessHours: rules.length === 0,
      rules: sortRulesByUiWeekdayOrder(normalizedRules).map((r) => ({ ...r })),
    })
    setSavedExceptionsState(groupedExceptionsForEditing.map((ex) => ({ ...ex })))
    setSavedProfileState({
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      email: staff.email ?? "",
      phoneDialCode: phoneParts.dialCode,
      phoneNational: phoneParts.nationalDigits,
      isActive: staff.isActive,
      panelMemberRole,
    })
    setSavedServiceIds([...serviceIds])
    setIsScheduleEditing(false)
    setIsExceptionsEditing(false)
  }

  const beginEdit = (staff: StaffMember) => {
    if (isStaffServiceOnboarding) {
      setFormTab("profile")
    }
    void loadStaffMemberIntoForm(staff, true)
  }

  const toggleService = (serviceId: string, serviceIsActive: boolean) => {
    if (!serviceIsActive && !form.serviceIds.includes(serviceId)) return
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((x) => x !== serviceId)
        : [...prev.serviceIds, serviceId],
    }))
  }

  const updateRule = (weekday: number, patch: Partial<StaffAvailabilityRuleInput>) => {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)),
    }))
  }

  const addException = () => {
    const seed =
      selectedCalendarDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedCalendarDate.trim())
        ? selectedCalendarDate.trim().slice(0, 10)
        : ""
    setForm((prev) => ({
      ...prev,
      exceptions: [
        ...prev.exceptions,
        {
          exceptionDate: seed,
          exceptionEndDate: seed,
          isClosed: true,
          startTime: "09:00",
          endTime: "17:00",
          reason: "",
        },
      ],
    }))
  }

  const updateException = (index: number, patch: Partial<StaffAvailabilityExceptionInput>) => {
    setForm((prev) => ({
      ...prev,
      exceptions: prev.exceptions.map((ex, idx) => (idx === index ? { ...ex, ...patch } : ex)),
    }))
  }

  const removeException = (index: number) => {
    setForm((prev) => ({
      ...prev,
      exceptions: prev.exceptions.filter((_, idx) => idx !== index),
    }))
  }

  const validateScheduleExceptionsList = (exceptions: StaffAvailabilityExceptionInput[]): boolean => {
    for (const ex of exceptions) {
      const date = ex.exceptionDate.trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setNotice(t("team.exceptionStartDateRequired"))
        setNoticeDetail(null)
        return false
      }
      const endDate = (ex.exceptionEndDate ?? "").trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        setNotice(t("team.exceptionEndDateRequired"))
        setNoticeDetail(null)
        return false
      }
      if (endDate < date) {
        setNotice(t("team.exceptionEndBeforeStart"))
        setNoticeDetail(null)
        return false
      }
      if (
        !ex.isClosed &&
        (!ex.startTime.trim() || !ex.endTime.trim() || toMinutes(ex.endTime) <= toMinutes(ex.startTime))
      ) {
        setNotice(language === "en" ? "Enter availability hours." : "Podaj godziny dostępności.")
        setNoticeDetail(null)
        return false
      }
    }
    return true
  }

  const validateForm = (): boolean => {
    const firstName = form.firstName.trim()
    const name = joinPersonName(form.firstName, form.lastName)
    const emailTrim = form.email.trim()
    const nationalDigits = form.phoneNational.replace(/\D/g, "")
    if (!firstName || !name) {
      setNotice(language === "en" ? "First name is required." : "Imię jest wymagane.")
      setNoticeDetail(null)
      return false
    }
    if (emailTrim && !EMAIL_RE.test(emailTrim)) {
      setNotice(t("team.validationEmailInvalid"))
      setNoticeDetail(null)
      return false
    }
    if (nationalDigits) {
      const v = validateNationalPhoneLength(form.phoneDialCode, form.phoneNational)
      if (!v.ok) {
        setNotice(t("team.validationPhoneInvalid"))
        setNoticeDetail(null)
        return false
      }
    }
    if (access.canManageInvitations && !emailTrim) {
      setNotice(t("team.validationEmailRequiredForInvite"))
      setNoticeDetail(null)
      return false
    }
    if (form.panelMemberRole !== "admin" && form.panelMemberRole !== "staff") {
      setNotice(t("team.validationPanelRoleRequired"))
      setNoticeDetail(null)
      return false
    }
    return true
  }

  const validateScheduleRulesForSave = (): boolean => {
    if (form.useBusinessHours) return true
    for (const rule of form.rules) {
      if (!rule.isAvailable) continue
      if (!rule.startTime?.trim() || !rule.endTime?.trim()) {
        setFormTab("schedule")
        setNotice(t("team.fillAvailableDayHours"))
        setNoticeDetail(null)
        return false
      }
      if (!isScheduleTimeRangeValid(rule.startTime, rule.endTime)) {
        setFormTab("schedule")
        setNotice(t("team.invalidTimeRange"))
        setNoticeDetail(null)
        return false
      }
    }
    return true
  }

  const saveScheduleExceptionsAndCollapse = async () => {
    setNoticeDetail(null)
    if (!validateScheduleExceptionsList(form.exceptions)) return

    if (editing && isSupabaseConfigured()) {
      const client = getBrowserClient()
      const bid = businessProfileId ?? access.businessId
      if (!client || !bid) {
        setNotice(language === "en" ? "Business profile was not found." : "Nie znaleziono profilu firmy.")
        setNoticeDetail(null)
        return
      }
      setSaving(true)
      try {
        const out = await saveStaffAvailabilityExceptions(client, bid, editing.id, form.exceptions)
        if (!out.ok) {
          setNotice(t("team.scheduleExceptionsSaveError"))
          if (process.env.NODE_ENV === "development" && out.error?.trim()) {
            setNoticeDetail(`${t("team.errorDetailsPrefix")} ${out.error.trim()}`)
          } else {
            setNoticeDetail(null)
          }
          return
        }
        const ctx = await getStaffAvailabilityContextForBusiness(client, bid, editing.id)
        const normalizedExceptions = groupExceptionsForEditing(
          ctx.exceptions.map((ex) => ({
            exceptionDate: ex.exceptionDate,
            exceptionEndDate: ex.exceptionDate,
            isClosed: ex.isUnavailable,
            startTime: ex.startTime ?? "09:00",
            endTime: ex.endTime ?? "17:00",
            reason: ex.reason ?? "",
          })),
        )
        setForm((prev) => ({ ...prev, exceptions: normalizedExceptions }))
        setSavedExceptionsState(normalizedExceptions.map((ex) => ({ ...ex })))
        setIsExceptionsEditing(false)
        setNotice(t("team.scheduleExceptionsSaved"))
        setNoticeDetail(null)
      } finally {
        setSaving(false)
      }
      return
    }

    setSavedExceptionsState(form.exceptions.map((ex) => ({ ...ex })))
    if (editing) {
      setIsExceptionsEditing(false)
    } else {
      setIsNewStaffExceptionsExpanded(false)
    }
    setNotice(t("team.scheduleExceptionsSaved"))
    setNoticeDetail(null)
  }

  const performSave = async () => {
    setNoticeDetail(null)
    if (!validateForm()) return
    if (!validateScheduleRulesForSave()) return
    const name = joinPersonName(form.firstName, form.lastName)
    const emailTrim = form.email.trim()
    const phoneForSave = buildStoredInternationalPhone(form.phoneDialCode, form.phoneNational)
    setSaving(true)
    try {
      const isDev = process.env.NODE_ENV === "development"
      const mapScheduleSaveError = (raw?: string) => {
        const normalized = (raw ?? "").trim().toLowerCase()
        if (raw === "schedule_empty_payload") return t("team.scheduleEmptyPayloadError")
        if (raw === "schedule_not_persisted_in_db") return t("team.scheduleNotPersistedError")
        if (
          normalized.includes("staff_availability_rules_time_chk") ||
          (normalized.includes("end_time") && normalized.includes("start_time"))
        ) {
          return t("team.invalidTimeRange")
        }
        return t("team.scheduleSaveError")
      }
      const client = getBrowserClient()
      const bid = businessProfileId ?? access.businessId
      if (!bid) {
        setNotice(language === "en" ? "Business profile was not found." : "Nie znaleziono profilu firmy.")
        setNoticeDetail(null)
        return
      }
      if (!businessProfileId && bid) {
        setBusinessProfileId(bid)
      }
      let partialNotices: string[] = []
      const msgAllSaved =
        language === "en" ? "Changes were saved." : "Zmiany zostały zapisane."
      const msgPartialSaved =
        language === "en"
          ? "Staff member was saved. Some additional settings need to be saved again."
          : "Osoba została zapisana. Niektóre dodatkowe ustawienia wymagają ponownego zapisania."
      const panelAccessNoticeForFailure = (
        messageKey?: string,
        detail?: string,
        serverError?: string,
      ) => {
        let key = "invitations.invitationCreateError"
        if (messageKey === "team.panelEmailRequired") key = "team.panelEmailRequired"
        else if (messageKey === "team.panelInviteEmailConflict") key = "team.panelInviteEmailConflict"
        else if (messageKey === "team.panelInviteOwnerEmail") key = "team.panelInviteOwnerEmail"
        else if (detail === "email_conflict") key = "team.panelInviteEmailConflict"
        else if (detail === "owner_email") key = "team.panelInviteOwnerEmail"
        else if (
          messageKey === "team.invitationServerNotConfigured" ||
          serverError === "supabase_unconfigured"
        ) {
          key = "team.invitationServerNotConfigured"
        } else if (messageKey === "team.migration082Required") key = "team.migration082Required"
        else if (messageKey) key = messageKey
        const line = t(key as "team.panelEmailRequired")
        if (detail?.trim()) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${detail.trim()}`)
          if (key === "invitations.invitationCreateError") {
            return `${line} (${detail.trim()})`
          }
        } else {
          setNoticeDetail(null)
        }
        return line
      }
      const panelAccessNoticeForSuccess = (panelRes: {
        invitationToken: string | null
        alreadyHasPanelAccess?: boolean
        emailOutcome?: "sent" | "not_configured" | "failed"
        detail?: string
      }) => {
        const notices: string[] = []
        if (panelRes.alreadyHasPanelAccess) {
          notices.push(t("team.panelAlreadyHasAccess"))
          return notices
        }
        if (panelRes.invitationToken && panelRes.invitationToken.length > 0) {
          const emailLine = panelRes.emailOutcome
            ? panelRes.emailOutcome === "sent"
              ? t("invitations.invitationEmailSent")
              : panelRes.emailOutcome === "not_configured"
                ? t("invitations.invitationEmailNotConfigured")
                : t("invitations.invitationEmailFailed")
            : null
          if (emailLine) notices.push(emailLine)
          else notices.push(t("invitations.invitationCreated"))
          return notices
        }
        const line = t("invitations.invitationCreateError")
        if (panelRes.detail?.trim()) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${panelRes.detail.trim()}`)
          return [`${line} (${panelRes.detail.trim()})`]
        }
        notices.push(line)
        return notices
      }
      const setSaveErrorWithDetail = (message: string, detail?: string) => {
        setNotice(message)
        if (detail?.trim()) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${detail.trim()}`)
        } else {
          setNoticeDetail(null)
        }
      }
      if (!editing) {
        if (process.env.NODE_ENV === "development") {
          console.info("[team.staff.save]", {
            staffId: null,
            businessId: bid,
            payload: {
              firstName: form.firstName,
              lastName: form.lastName,
              fullName: name,
              phone: phoneForSave,
              email: form.email,
              isActive: form.isActive,
              role: form.panelMemberRole,
            },
            error: null,
          })
        }
        const created = await addStaffMember(client, bid, {
          name,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.panelMemberRole,
          email: form.email,
          phone: phoneForSave,
          isActive: form.isActive,
          serviceIds: form.serviceIds,
        })
        if (!created.ok) {
          setSaveErrorWithDetail(t("team.saveError"), created.error)
          return
        }
        const newStaffId = created.id
        if (created.servicesLinked === false) {
          partialNotices = [...partialNotices, t("team.servicesPartialSaved")]
        }
        if (isDev) {
          console.debug("[team.schedule.save.call] create", {
            staffId: newStaffId,
            businessId: bid,
            useBusinessHours: form.useBusinessHours,
            scheduleState: form.rules,
          })
        }
        const rulesOutCreate = await saveStaffAvailabilityRules(
          client,
          bid,
          newStaffId,
          form.useBusinessHours ? [] : form.rules,
        )
        if (!rulesOutCreate.ok) {
          setFormTab("schedule")
          setIsScheduleEditing(true)
          partialNotices = [...partialNotices, mapScheduleSaveError(rulesOutCreate.error)]
          if (rulesOutCreate.error?.trim() && mapScheduleSaveError(rulesOutCreate.error) === t("team.scheduleSaveError")) {
            setNoticeDetail(`${t("team.errorDetailsPrefix")} ${rulesOutCreate.error.trim()}`)
          } else {
            setNoticeDetail(null)
          }
        }
        if (!validateScheduleExceptionsList(form.exceptions)) {
          setFormTab("exceptions")
          setSaving(false)
          return
        }
        const excOut = await saveStaffAvailabilityExceptions(client, bid, newStaffId, form.exceptions)
        if (!excOut.ok) {
          partialNotices = [...partialNotices, t("team.scheduleExceptionsSaveError")]
          if (process.env.NODE_ENV === "development" && excOut.error?.trim()) {
            setNoticeDetail(`${t("team.errorDetailsPrefix")} ${excOut.error.trim()}`)
          }
        }
        let inviteToken: string | null = null
        if (bid && access.canManageInvitations && isSupabaseConfigured() && emailTrim) {
          const panelRes = await requestPanelAccessForStaff(newStaffId, form.email, form.panelMemberRole)
          if (!panelRes.ok) {
            partialNotices = [
              ...partialNotices,
              panelAccessNoticeForFailure(
                panelRes.messageKey,
                panelRes.detail,
                panelRes.serverError,
              ),
            ]
          } else {
            inviteToken = panelRes.invitationToken
            partialNotices = [...partialNotices, ...panelAccessNoticeForSuccess(panelRes)]
            if (inviteToken) setSidebarTab("invites")
          }
        }
        if (client && bid && isSupabaseConfigured()) {
          const syncOutCreate = await syncBusinessMemberRoleForStaff(
            client,
            bid,
            newStaffId,
            form.panelMemberRole,
          )
          if (!syncOutCreate.ok && process.env.NODE_ENV === "development" && syncOutCreate.detail) {
            console.warn("[team] business_members role sync (create):", syncOutCreate.detail)
          }
        }
        await load()
        let highlightId: string | null = null
        if (client && bid && inviteToken) {
          const { data: invRow } = await client
            .from("business_invitations")
            .select("id")
            .eq("business_id", bid)
            .eq("token", inviteToken)
            .maybeSingle()
          if (invRow?.id) highlightId = invRow.id as string
        }
        await loadStaffMemberIntoForm(
          {
            id: newStaffId,
            businessId: bid,
            name,
            role: form.panelMemberRole,
            email: emailTrim || undefined,
            phone: phoneForSave || undefined,
            isActive: form.isActive,
          },
          false,
        )
        if (highlightId) setInviteHighlightId(highlightId)
        if (partialNotices.length > 0) {
          setNotice(partialNotices[0] ?? msgPartialSaved)
          if (!noticeDetail) {
            setNoticeDetail(partialNotices.length > 1 ? partialNotices.slice(1).join("\n") : null)
          }
        } else {
          setNotice(msgAllSaved)
          setNoticeDetail(null)
          if (process.env.NODE_ENV === "development") {
            console.info("[team.staff.saved]", {
              saved: {
                id: newStaffId,
                fullName: name,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
              },
            })
          }
        }
        return
      }
      if (process.env.NODE_ENV === "development") {
        console.info("[team.staff.save]", {
          staffId: editing.id,
          businessId: bid,
          payload: {
            firstName: form.firstName,
            lastName: form.lastName,
            fullName: name,
            phone: phoneForSave,
            email: form.email,
            isActive: form.isActive,
            role: form.panelMemberRole,
          },
          error: null,
        })
      }
      const out = await updateStaffMember(client, bid, editing.id, {
        name,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.panelMemberRole,
        email: form.email,
        phone: phoneForSave,
        isActive: form.isActive,
        serviceIds: form.serviceIds,
      })
      if (!out.ok) {
        if (process.env.NODE_ENV === "development") {
          console.info("[team.staff.save]", {
            staffId: editing.id,
            businessId: bid,
            payload: {
              firstName: form.firstName,
              lastName: form.lastName,
              fullName: name,
            },
            error: out.error ?? null,
          })
        }
        setSaveErrorWithDetail(t("team.saveError"), out.error)
        return
      }
      if (client && bid && isSupabaseConfigured()) {
        const syncOut = await syncBusinessMemberRoleForStaff(client, bid, editing.id, form.panelMemberRole)
        if (!syncOut.ok) {
          if (process.env.NODE_ENV === "development" && syncOut.detail) {
            console.warn("[team] business_members role sync:", syncOut.detail)
          }
        }
      }
      setItems((prev) =>
        prev.map((x) =>
          x.id === editing.id
            ? {
                ...x,
                name,
                role: form.panelMemberRole,
                email: emailTrim || undefined,
                phone: phoneForSave || undefined,
                isActive: form.isActive,
              }
            : x,
        ),
      )
      await refetchStaffMembers(client, bid)
      if (out.servicesLinked === false) {
        partialNotices = [...partialNotices, t("team.servicesPartialSaved")]
      }
      const rulesOut = await saveStaffAvailabilityRules(
        client,
        bid,
        editing.id,
        form.useBusinessHours ? [] : form.rules,
      )
      let scheduleSavedOk = rulesOut.ok
      if (isDev) {
        console.debug("[team.schedule.save.call] edit", {
          staffId: editing.id,
          businessId: bid,
          useBusinessHours: form.useBusinessHours,
          scheduleState: form.rules,
          error: rulesOut.ok ? null : rulesOut.error ?? null,
        })
      }
      if (!rulesOut.ok) {
        setFormTab("schedule")
        setIsScheduleEditing(true)
        partialNotices = [...partialNotices, mapScheduleSaveError(rulesOut.error)]
        if (rulesOut.error?.trim() && mapScheduleSaveError(rulesOut.error) === t("team.scheduleSaveError")) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${rulesOut.error.trim()}`)
        } else {
          setNoticeDetail(null)
        }
      }
      if (!validateScheduleExceptionsList(form.exceptions)) {
        setFormTab("exceptions")
        setSaving(false)
        return
      }
      const excOut = await saveStaffAvailabilityExceptions(client, bid, editing.id, form.exceptions)
      if (!excOut.ok) {
        partialNotices = [...partialNotices, t("team.scheduleExceptionsSaveError")]
        if (process.env.NODE_ENV === "development" && excOut.error?.trim()) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${excOut.error.trim()}`)
        }
      }
      let editInviteToken: string | null = null
      if (bid && access.canManageInvitations && isSupabaseConfigured() && emailTrim) {
        const panelRes = await requestPanelAccessForStaff(editing.id, form.email, form.panelMemberRole)
        if (!panelRes.ok) {
          partialNotices = [
            ...partialNotices,
            panelAccessNoticeForFailure(
              panelRes.messageKey,
              panelRes.detail,
              panelRes.serverError,
            ),
          ]
        } else {
          editInviteToken = panelRes.invitationToken
          partialNotices = [...partialNotices, ...panelAccessNoticeForSuccess(panelRes)]
          if (editInviteToken) setSidebarTab("invites")
        }
      }
      await load()
      let editHighlightId: string | null = null
      if (client && bid && editInviteToken) {
        const { data: invRow } = await client
          .from("business_invitations")
          .select("id")
          .eq("business_id", bid)
          .eq("token", editInviteToken)
          .maybeSingle()
        if (invRow?.id) editHighlightId = invRow.id as string
      }
      if (editHighlightId) setInviteHighlightId(editHighlightId)
      if (partialNotices.length > 0) {
        setNotice(partialNotices[0] ?? msgPartialSaved)
        if (!noticeDetail) {
          setNoticeDetail(partialNotices.length > 1 ? partialNotices.slice(1).join("\n") : null)
        }
      } else {
        setNotice(msgAllSaved)
        setNoticeDetail(null)
        if (process.env.NODE_ENV === "development") {
          console.info("[team.staff.saved]", {
            saved: {
              id: editing.id,
              fullName: name,
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
            },
          })
        }
      }
      const [{ rules: refreshedRules, exceptions: refreshedExceptions }, refreshedServiceIds] = await Promise.all([
        getStaffAvailabilityContextForBusiness(client, bid, editing.id),
        getStaffServiceIds(client, bid, editing.id),
      ])
      const normalizedRules = sortRulesByUiWeekdayOrder(
        refreshedRules.length > 0 ? refreshedRules : emptyForm().rules,
      )
      const normalizedExceptions = groupExceptionsForEditing(
        refreshedExceptions.map((ex) => ({
          exceptionDate: ex.exceptionDate,
          exceptionEndDate: ex.exceptionDate,
          isClosed: ex.isUnavailable,
          startTime: ex.startTime ?? "09:00",
          endTime: ex.endTime ?? "17:00",
          reason: ex.reason ?? "",
        })),
      )
      setForm((prev) => ({
        ...prev,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phoneDialCode: form.phoneDialCode,
        phoneNational: form.phoneNational,
        isActive: form.isActive,
        serviceIds: refreshedServiceIds,
        useBusinessHours: refreshedRules.length === 0,
        rules: normalizedRules,
        exceptions: normalizedExceptions,
      }))
      setSavedScheduleState({
        useBusinessHours: refreshedRules.length === 0,
        rules: normalizedRules.map((r) => ({ ...r })),
      })
      setSavedExceptionsState(normalizedExceptions.map((ex) => ({ ...ex })))
      setSavedProfileState({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: emailTrim,
        phoneDialCode: form.phoneDialCode,
        phoneNational: form.phoneNational,
        isActive: form.isActive,
        panelMemberRole: form.panelMemberRole,
      })
      setSavedServiceIds([...refreshedServiceIds])
      setItems((prev) =>
        prev.map((x) =>
          x.id === editing.id
            ? {
                ...x,
                name,
                role: form.panelMemberRole,
                email: emailTrim || undefined,
                phone: phoneForSave || undefined,
                isActive: form.isActive,
              }
            : x,
        ),
      )
      setEditing((prev) =>
        prev && prev.id === editing.id
          ? {
              ...prev,
              name,
              role: form.panelMemberRole,
              email: emailTrim || undefined,
              phone: phoneForSave || undefined,
              isActive: form.isActive,
            }
          : prev,
      )
      if (scheduleSavedOk) {
        setIsScheduleEditing(false)
      } else {
        setIsScheduleEditing(true)
      }
      setIsExceptionsEditing(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error"
      setNotice(t("team.saveError"))
      if (process.env.NODE_ENV === "development") {
        setNoticeDetail(`${t("team.errorDetailsPrefix")} ${message}`)
        console.error("[team.staff.save.unhandled]", message)
      } else {
        setNoticeDetail(null)
      }
    } finally {
      setSaving(false)
    }
  }

  const remove = async (staffId: string) => {
    if (!window.confirm(t("team.deleteConfirm"))) return
    const client = getBrowserClient()
    const out = await deleteStaffMember(client, businessProfileId, staffId)
    if (!out.ok) {
      setNotice(t("team.deleteError"))
      return
    }
    if (editing?.id === staffId) resetFormToCreate()
    await load()
    setNotice(t("team.deleted"))
  }

  const activateStaff = async (staff: StaffMember) => {
    const client = getBrowserClient()
    const bid = businessProfileId
    const out = await updateStaffMember(client, bid, staff.id, { isActive: true })
    if (!out.ok) {
      setNotice(t("team.saveError"))
      return
    }
    await load()
    if (editing?.id === staff.id) {
      setForm((f) => ({ ...f, isActive: true }))
    }
    setNotice(t("team.saved"))
  }

  const copyInvitationLink = async (token: string) => {
    const url = `${window.location.origin}/accept-invite/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setNotice(t("invitations.linkCopied"))
    } catch {
      setNotice(url)
    }
  }

  type InvitationEmailSendOutcome = "sent" | "not_configured" | "failed"

  const requestPanelAccessForStaff = async (
    staffMemberId: string,
    invitationEmail: string,
    panelMemberRole: PanelRole,
  ): Promise<
    | {
        ok: true
        invitationToken: string | null
        alreadyHasPanelAccess?: boolean
        emailOutcome?: InvitationEmailSendOutcome
      }
    | { ok: false; messageKey?: string; detail?: string; serverError?: string }
  > => {
    try {
      const res = await fetch("/api/team/apply-panel-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffMemberId,
          invitationEmail,
          panelMemberRole,
          language,
          sendEmail: true,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        invitationToken?: string | null
        messageKey?: string
        detail?: string | null
        error?: string
        alreadyHasPanelAccess?: boolean
        email?: { sent?: boolean; code?: string }
      } | null
      if (!json?.ok) {
        const serverError = typeof json?.error === "string" ? json.error : undefined
        return {
          ok: false,
          messageKey:
            json?.messageKey ??
            (serverError === "supabase_unconfigured"
              ? "team.invitationServerNotConfigured"
              : undefined),
          detail: json?.detail ?? undefined,
          serverError,
        }
      }
      const token =
        typeof json.invitationToken === "string" && json.invitationToken.length > 0
          ? json.invitationToken
          : null
      if (!json.alreadyHasPanelAccess && !token) {
        return {
          ok: false,
          messageKey: "invitations.invitationCreateError",
          detail: json?.detail ?? "invitation_token_missing",
        }
      }
      let emailOutcome: InvitationEmailSendOutcome | undefined
      if (token) {
        if (json.email?.sent) emailOutcome = "sent"
        else if (
          json.email?.code === "not_configured" ||
          json.email?.code === "simulated_dev"
        ) {
          emailOutcome = "not_configured"
        } else if (json.email?.code) {
          emailOutcome = "failed"
        }
      }
      return {
        ok: true,
        invitationToken: token,
        alreadyHasPanelAccess: json.alreadyHasPanelAccess === true,
        emailOutcome,
      }
    } catch {
      return { ok: false, messageKey: "invitations.invitationCreateError" }
    }
  }

  const sendInvitationEmailByToken = async (token: string): Promise<InvitationEmailSendOutcome> => {
    try {
      const res = await fetch("/api/team/send-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, language }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (json?.ok) return "sent"
      const err = json?.error
      if (err === "not_configured" || err === "simulated_dev") return "not_configured"
      return "failed"
    } catch {
      return "failed"
    }
  }

  const invitationEmailNoticeForOutcome = (outcome: InvitationEmailSendOutcome): string | null => {
    if (outcome === "sent") return t("invitations.invitationEmailSent")
    if (outcome === "not_configured") return t("invitations.invitationEmailNotConfigured")
    if (outcome === "failed") return t("invitations.invitationEmailFailed")
    return null
  }

  const appendInvitationEmailNotice = (
    notices: string[],
    outcome: InvitationEmailSendOutcome,
  ): string[] => {
    const line = invitationEmailNoticeForOutcome(outcome)
    return line ? [...notices, line] : notices
  }

  const resendInvitationEmail = async (token: string) => {
    const outcome = await sendInvitationEmailByToken(token)
    const line = invitationEmailNoticeForOutcome(outcome)
    if (line) setNotice(line)
  }

  const cancelInvitation = async (invitationId: string) => {
    const client = getBrowserClient()
    const bid = businessProfileId
    if (!client || !bid) return
    const { error } = await client
      .from("business_invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId)
      .eq("business_id", bid)
    if (error) {
      setNotice(t("invitations.invitationCreateError"))
      return
    }
    await load()
    setNotice(t("invitations.cancelled"))
  }

  const activeServices = React.useMemo(() => services.filter((s) => s.isActive), [services])
  const pendingInvites = React.useMemo(
    () => panelInvites.filter((inv) => inv.status === "pending"),
    [panelInvites],
  )
  const filteredStaff = React.useMemo(() => {
    const q = staffQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter((s) => {
      const hay = `${s.name} ${(s.email ?? "").trim()} ${(s.phone ?? "").trim()}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, staffQuery])

  const inviteStatusLabel = (status: string) => {
    if (status === "pending") return t("invitations.pendingInvitation")
    if (status === "accepted") return t("invitations.invitationAccepted")
    if (status === "cancelled") return t("invitations.cancelled")
    return status
  }

  if (access.ready && !access.canManageTeam) {
    return (
      <AppShell title={t("navigation.team")} pageDescription={t("team.description")}>
        <PageShell>
          <AccessDenied />
        </PageShell>
      </AppShell>
    )
  }

  const livePersonName = joinPersonName(form.firstName, form.lastName)
  const formCardTitle = editing
    ? `${t("team.edit")}${livePersonName ? ` — ${livePersonName}` : ""}`
    : `${t("team.addPersonCard")}${livePersonName ? ` — ${livePersonName}` : ""}`
  const submitLabel = editing ? t("team.saveChanges") : t("team.save")
  const showSchedulePreview = Boolean(editing) && !isScheduleEditing
  const showExceptionsCompact =
    (Boolean(editing) && !isExceptionsEditing) ||
    (!editing && !isNewStaffExceptionsExpanded)
  const calendarMonthLabel = monthLabelFmt.format(calendarMonth)
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
  const jsWeekday = firstDay.getDay()
  const mondayStartOffset = (jsWeekday + 6) % 7
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - mondayStartOffset)
  const calendarGridDays: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    calendarGridDays.push(d)
  }

  const selectedDayException = selectedCalendarDate ? calendarExceptionsByDay.get(selectedCalendarDate) : null
  const selectedDayHoliday = selectedCalendarDate ? calendarHolidaysByDay.get(selectedCalendarDate) : null

  return (
    <AppShell title={t("navigation.team")} pageDescription={t("team.description")}>
      <PageShell>
        {notice ? (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
            <p>{notice}</p>
            {noticeDetail ? <p className="mt-1 text-xs text-muted-foreground">{noticeDetail}</p> : null}
          </div>
        ) : null}

        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
            <Card
              data-tour={staffServiceTourNeedsPerson ? "team-staff-service-target" : undefined}
              className="min-w-0 overflow-hidden rounded-2xl border border-border"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{t("navigation.team")}</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl px-3"
                    onClick={() => resetFormToCreate()}
                  >
                    + {t("team.addPersonCard")}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-staff-search" className="text-xs text-muted-foreground">
                    {language === "en" ? "Search" : "Szukaj"}
                  </Label>
                  <Input
                    id="team-staff-search"
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    placeholder={language === "en" ? "Name, email, phone..." : "Imię, e-mail, telefon..."}
                    className="h-10 rounded-xl"
                  />
                </div>
                <Tabs
                  value={sidebarTab}
                  onValueChange={(v) => setSidebarTab(v === "invites" ? "invites" : "members")}
                  className="w-full"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="members" className="flex-1">
                      {t("team.teamMembersTitle")}
                    </TabsTrigger>
                    {access.ready && access.canManageInvitations ? (
                      <TabsTrigger value="invites" className="flex-1">
                        {t("team.pendingInvitationsTitle")}
                      </TabsTrigger>
                    ) : null}
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3">
                <Tabs value={sidebarTab} className="w-full">
                  <TabsContent value="members" className="mt-0 space-y-3">
                    {loading ? <p className="text-sm text-muted-foreground">{t("team.loading")}</p> : null}
                    {!loading && staffLoadError ? (
                      <p className="text-sm text-destructive">
                        {language === "en" ? "Failed to load team members." : "Nie udało się załadować osób."}
                      </p>
                    ) : null}
                    {!loading && !staffLoadError && items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("team.teamMembersEmpty")}</p>
                    ) : null}
                    {!loading && !staffLoadError && items.length > 0 && filteredStaff.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {language === "en" ? "No matches." : "Brak wyników."}
                      </p>
                    ) : null}
                    {!loading &&
                      filteredStaff.map((staff) => {
                        const svcIds = serviceIdsByStaff[staff.id] ?? []
                        const svcNames = svcIds
                          .map((sid) => services.find((s) => s.id === sid)?.name)
                          .filter(Boolean)
                          .join(", ")
                        const staffRoleLabel =
                          normalizeStaffRole(staff.role) === "admin"
                            ? t("invitations.adminRoleOption")
                            : t("invitations.staffRoleOption")
                        return (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => beginEdit(staff)}
                            className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                              editing?.id === staff.id
                                ? "border-primary/40 bg-[color:var(--nav-active-bg)]"
                                : "border-border/80 bg-muted/10 hover:bg-muted/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="truncate font-semibold text-foreground">{getStaffDisplayName(staff)}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {(staff.email ?? "").trim() || "-"} · {(staff.phone ?? "").trim() || "-"}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {t("team.panelRole")}: {staffRoleLabel}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {t("team.servicesShort")}: {svcNames || t("team.noServicesAssigned")}
                                </p>
                              </div>
                              <Badge
                                variant={staff.isActive ? "default" : "secondary"}
                                className="shrink-0 rounded-lg text-[0.65rem] font-normal"
                              >
                                {staff.isActive ? t("team.active") : t("services.hiddenStatus")}
                              </Badge>
                            </div>
                          </button>
                        )
                      })}
                  </TabsContent>

                  {access.ready && access.canManageInvitations ? (
                    <TabsContent value="invites" className="mt-0 space-y-3">
                      <p className="text-xs text-muted-foreground">{t("invitations.pendingInvitationsEmailHint")}</p>
                      {pendingInvites.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("team.pendingInvitationsEmpty")}</p>
                      ) : (
                        <ul className="space-y-3">
                          {pendingInvites.map((inv) => {
                            const roleLabel =
                              inv.role === "admin"
                                ? t("invitations.adminRoleOption")
                                : t("invitations.staffRoleOption")
                            const created = dateTimeFmt.format(new Date(inv.created_at))
                            const highlight = inviteHighlightId === inv.id
                            return (
                              <li
                                key={inv.id}
                                className={`rounded-xl border px-3 py-3 text-sm ${
                                  highlight
                                    ? "border-primary/40 bg-[color:var(--nav-active-bg)]"
                                    : "border-border/80 bg-muted/10"
                                }`}
                              >
                                <div className="min-w-0 space-y-1">
                                  <p className="truncate font-medium">{inv.email}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {t("team.panelRole")}: {roleLabel}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {t("team.inviteCreatedAt")}: {created}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {t("team.inviteStatus")}: {inviteStatusLabel(inv.status)}
                                  </p>
                                </div>
                                <div className="mt-3 flex flex-col gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 w-full rounded-xl"
                                    onClick={() => void copyInvitationLink(inv.token)}
                                  >
                                    <Copy className="size-4" aria-hidden />
                                    {t("invitations.copyInvitationLink")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-10 w-full rounded-xl"
                                    onClick={() => void resendInvitationEmail(inv.token)}
                                  >
                                    {t("invitations.resendInvitationEmail")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-10 w-full rounded-xl text-destructive hover:text-destructive"
                                    onClick={() => void cancelInvitation(inv.id)}
                                  >
                                    {t("team.cancelInvitation")}
                                  </Button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </TabsContent>
                  ) : null}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <Card
            data-tour="team-person-form"
            className="min-w-0 overflow-hidden rounded-2xl border border-border"
          >
            <CardHeader>
              <CardTitle className="text-lg">{formCardTitle}</CardTitle>
              {editing ? (
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  {!editing.isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl px-3"
                      onClick={() => void activateStaff(editing)}
                    >
                      {t("team.activate")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-9 rounded-xl px-3"
                    onClick={() => void remove(editing.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t("common.delete")}
                  </Button>
                </div>
              ) : null}
              {!editing ? (
                <CardDescription className="text-muted-foreground">{t("team.emailHelp")}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className={`min-w-0 ${editing ? "overflow-visible" : "overflow-x-hidden"}`}>
              <form
                id="team-person-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void performSave()
                }}
                className="space-y-6"
              >
                <Tabs
                  value={formTab}
                  onValueChange={(v) => {
                    const allowed =
                      v === "panel" || v === "services" || v === "schedule" || v === "exceptions" ? v : "profile"
                    setFormTab(allowed)
                  }}
                  className="w-full"
                >
                  <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
                    <TabsTrigger value="profile" className="h-9 whitespace-normal px-2 text-xs leading-tight sm:text-sm">
                      {t("team.personDetailsSection")}
                    </TabsTrigger>
                    {access.canManageInvitations ? (
                      <TabsTrigger value="panel" className="h-9 whitespace-normal px-2 text-xs leading-tight sm:text-sm">
                        {t("team.panelAccessSection")}
                      </TabsTrigger>
                    ) : null}
                    <TabsTrigger
                      value="services"
                      className="h-9 whitespace-normal px-2 text-xs leading-tight sm:text-sm"
                      data-tour={
                        staffServiceTourNeedsServicesTab
                          ? "team-staff-service-target"
                          : "team-services-tab"
                      }
                    >
                      {t("team.servicesForStaff")}
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="h-9 whitespace-normal px-2 text-xs leading-tight sm:text-sm">
                      {t("team.schedule")}
                    </TabsTrigger>
                    <TabsTrigger value="exceptions" className="h-9 whitespace-normal px-2 text-xs leading-tight sm:text-sm">
                      {t("team.scheduleExceptionsTitle")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile" className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="staff-first-name">{t("team.firstName")}</Label>
                        <Input
                          id="staff-first-name"
                          value={form.firstName}
                          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                          className="h-11 rounded-xl"
                          autoComplete="given-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-last-name">{t("team.lastName")}</Label>
                        <Input
                          id="staff-last-name"
                          value={form.lastName}
                          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                          className="h-11 rounded-xl"
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                    <InternationalPhoneFieldGroup
                      label={t("team.phone")}
                      dialCode={form.phoneDialCode}
                      nationalDigits={form.phoneNational}
                      onDialCodeChange={(v) => setForm((f) => ({ ...f, phoneDialCode: v }))}
                      onNationalChange={(digits) =>
                        setForm((f) => ({ ...f, phoneNational: digits }))
                      }
                      dialSelectId="staff-phone-dial"
                      nationalInputId="staff-phone"
                    />
                    <div className="space-y-2">
                      <Label htmlFor="staff-email">{t("team.contactEmail")}</Label>
                      <Input
                        id="staff-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="h-11 rounded-xl"
                        autoComplete="email"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                      <Label htmlFor="staff-active">{t("team.active")}</Label>
                      <Switch
                        id="staff-active"
                        checked={form.isActive}
                        onCheckedChange={(checked) =>
                          setForm((f) => ({ ...f, isActive: Boolean(checked) }))
                        }
                      />
                    </div>
                  </TabsContent>

                  {access.canManageInvitations ? (
                    <TabsContent value="panel" className="mt-5 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="panel-member-role">{t("team.panelRole")}</Label>
                        <Select
                          value={form.panelMemberRole}
                          onValueChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              panelMemberRole: v === "admin" ? "admin" : "staff",
                            }))
                          }
                        >
                          <SelectTrigger id="panel-member-role" className="h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">{t("invitations.staffRoleOption")}</SelectItem>
                            <SelectItem value="admin">{t("invitations.adminRoleOption")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {form.panelMemberRole === "admin"
                            ? t("team.panelRoleOwnerHint")
                            : t("team.panelRoleStaffHint")}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {t("team.panelAccessIntro")}
                        </p>
                      </div>
                    </TabsContent>
                  ) : null}

                  <TabsContent
                    value="services"
                    className="mt-5 space-y-3"
                    data-tour={staffServiceTourNeedsServiceChoice ? "team-staff-service-target" : undefined}
                  >
                    <div className="min-w-0 space-y-2">
                      {services.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                          <p>{t("team.servicesEmptyHint")}</p>
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-3 h-11 w-full rounded-xl sm:w-auto"
                            asChild
                          >
                            <Link href="/services">{t("team.goToServices")}</Link>
                          </Button>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {services.map((service) => {
                            const checked = form.serviceIds.includes(service.id)
                            const canAssign = service.isActive || checked
                            return (
                              <li key={service.id} className="min-w-0">
                                <label
                                  className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                                    checked
                                      ? "border-primary bg-[color:var(--nav-active-bg)]"
                                      : "border-border bg-card"
                                  } ${!canAssign ? "cursor-not-allowed opacity-60" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 size-4 shrink-0 rounded border-border"
                                    checked={checked}
                                    disabled={!canAssign}
                                    onChange={() => toggleService(service.id, service.isActive)}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-medium text-foreground">{service.name}</span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
                                      <span>
                                        {t("team.durationLabel").replace("{n}", String(service.durationMinutes))}
                                      </span>
                                      <span aria-hidden>·</span>
                                      <span>{formatPrice(service)}</span>
                                      {!service.isActive ? (
                                        <>
                                          <span aria-hidden>·</span>
                                          <Badge variant="secondary" className="text-[0.65rem] font-normal">
                                            {t("services.hiddenStatus")}
                                          </Badge>
                                        </>
                                      ) : null}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {activeServices.length === 0 && services.length > 0 ? (
                        <p className="text-xs text-muted-foreground">{t("team.servicesOnlyHiddenHint")}</p>
                      ) : null}
                    </div>
                  </TabsContent>
                  <TabsContent value="schedule" className="mt-5">
                    <div className="space-y-4">
                      <div className="w-full max-w-none min-w-0 space-y-3 overflow-x-hidden rounded-xl border border-border/70 p-4">
                        <p className="text-sm font-semibold text-foreground">{t("team.schedule")}</p>
                        {showSchedulePreview ? (
                          <div className="space-y-3">
                            {form.useBusinessHours ? (
                              <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                                <p className="text-sm font-medium text-foreground">
                                  {t("team.usesBusinessWorkingHours")}
                                </p>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {t("team.usesBusinessWorkingHoursDescription")}
                                </p>
                              </div>
                            ) : (
                              form.rules.map((rule) => (
                                <div
                                  key={rule.weekday}
                                  className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm leading-relaxed text-foreground"
                                >
                                  <span className="font-medium">{t(weekdayLabelKey(rule.weekday))}</span>
                                  <span className="text-muted-foreground">: </span>
                                  {rule.isAvailable ? (
                                    <>
                                      <span>{t("availability.open")}</span>
                                      <span className="text-muted-foreground">
                                        {" "}
                                        {rule.startTime}-{rule.endTime}
                                      </span>
                                    </>
                                  ) : (
                                    <span>{t("availability.closed")}</span>
                                  )}
                                </div>
                              ))
                            )}
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-xl"
                                onClick={() => setIsScheduleEditing(true)}
                              >
                                {t("team.editSchedule")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <Label htmlFor="use-biz-hours" className="text-sm font-medium">
                                  {t("team.useBusinessHours")}
                                </Label>
                                <Switch
                                  id="use-biz-hours"
                                  checked={form.useBusinessHours}
                                  onCheckedChange={(checked) =>
                                    setForm((f) => ({ ...f, useBusinessHours: Boolean(checked) }))
                                  }
                                />
                              </div>
                              {form.useBusinessHours ? (
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                  {t("team.useBusinessHoursDescription")}
                                </p>
                              ) : null}
                            </div>
                            {!form.useBusinessHours ? (
                              <div className="overflow-hidden rounded-xl border border-border/70">
                                <ul className="divide-y divide-border/70">
                                  {sortRulesByUiWeekdayOrder(form.rules).map((rule) => {
                                    const rowInvalid =
                                      rule.isAvailable &&
                                      !isScheduleTimeRangeValid(rule.startTime, rule.endTime)
                                    return (
                                    <li
                                      key={rule.weekday}
                                      className={`grid min-w-0 grid-cols-[2.75rem_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 px-3 py-2 sm:py-2.5 ${
                                        rowInvalid ? "bg-destructive/5" : ""
                                      }`}
                                    >
                                      <span
                                        className="text-sm font-semibold text-foreground"
                                        title={t(weekdayLabelKey(rule.weekday))}
                                      >
                                        {weekdayShortLabel(t, rule.weekday)}
                                      </span>
                                      <Switch
                                        checked={rule.isAvailable}
                                        onCheckedChange={(checked) =>
                                          updateRule(rule.weekday, { isAvailable: Boolean(checked) })
                                        }
                                        aria-label={t(weekdayLabelKey(rule.weekday))}
                                      />
                                      {rule.isAvailable ? (
                                        <div className="min-w-0 space-y-1">
                                          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                                            <Input
                                              id={`start-${rule.weekday}`}
                                              type="time"
                                              value={rule.startTime}
                                              onChange={(e) =>
                                                updateRule(rule.weekday, { startTime: e.target.value })
                                              }
                                              aria-invalid={rowInvalid}
                                              aria-label={`${t(weekdayLabelKey(rule.weekday))} — ${t("team.timeFrom")}`}
                                              className={`h-9 min-w-0 flex-1 max-w-[7.25rem] rounded-lg px-2 text-sm tabular-nums ${
                                                rowInvalid ? "border-destructive" : ""
                                              }`}
                                            />
                                            <span
                                              className="shrink-0 text-xs text-muted-foreground"
                                              aria-hidden
                                            >
                                              –
                                            </span>
                                            <Input
                                              id={`end-${rule.weekday}`}
                                              type="time"
                                              value={rule.endTime}
                                              onChange={(e) =>
                                                updateRule(rule.weekday, { endTime: e.target.value })
                                              }
                                              aria-invalid={rowInvalid}
                                              aria-label={`${t(weekdayLabelKey(rule.weekday))} — ${t("team.timeTo")}`}
                                              className={`h-9 min-w-0 flex-1 max-w-[7.25rem] rounded-lg px-2 text-sm tabular-nums ${
                                                rowInvalid ? "border-destructive" : ""
                                              }`}
                                            />
                                          </div>
                                          {rowInvalid ? (
                                            <p className="text-xs text-destructive">{t("team.invalidTimeRange")}</p>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <p className="text-right text-xs text-muted-foreground sm:text-left">
                                          {t("availability.closed")}
                                        </p>
                                      )}
                                    </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="exceptions" className="mt-5">
                    <div className="space-y-5">
                      <div className="w-full max-w-none min-w-0 space-y-3 overflow-x-hidden rounded-xl border border-border/70 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{t("team.scheduleExceptionsTitle")}</p>
                          <p className="text-xs text-muted-foreground">{t("team.scheduleExceptionsHint")}</p>
                        </div>
                        <div className="space-y-6">
                          <div className={`min-w-0 ${isExceptionsEditing ? "space-y-3" : ""}`}>
                            {isExceptionsEditing ? (
                              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                                <p className="text-sm font-semibold text-foreground">
                                  {language === "en" ? "Editing schedule exceptions" : "Edycja wyjątków grafiku"}
                                </p>
                              </div>
                            ) : null}
                            {showExceptionsCompact ? (
                              <div className="space-y-3">
                                {form.exceptions.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    {t("team.scheduleExceptionsEmpty")}
                                  </p>
                                ) : (
                                  <div className="space-y-3">
                                    {groupedExceptionPreview.map((item, idx) => (
                                      <div
                                        key={`grp-${idx}-${item.startDate}-${item.endDate}-${item.type}`}
                                        className="rounded-xl border border-border/70 bg-muted/20 p-3"
                                      >
                                        <p className="text-sm font-medium text-foreground">
                                          {formatExceptionPreviewDate(item.startDate)}
                                          {item.startDate !== item.endDate
                                            ? ` - ${formatExceptionPreviewDate(item.endDate)}`
                                            : ""}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {item.type === "time_off_group"
                                            ? t("team.exceptionTypeClosed")
                                            : `${t("team.exceptionTypeSpecialHours")}: ${item.specialHours?.startTime ?? ""}-${item.specialHours?.endTime ?? ""}`}
                                        </p>
                                        {(item.note ?? "").trim() ? (
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {t("team.exceptionReasonLabel")}: {item.note}
                                          </p>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-xl"
                                    onClick={() => {
                                      setIsExceptionsEditing(true)
                                      setIsNewStaffExceptionsExpanded(true)
                                    }}
                                  >
                                    {t("team.editExceptions")}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {form.exceptions.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    {t("team.scheduleExceptionsEmpty")}
                                  </p>
                                ) : (
                                  <div className="space-y-4">
                                    {form.exceptions.map((ex, idx) => (
                                      <div
                                        key={`${idx}-${ex.exceptionDate}`}
                                        className="rounded-xl border border-border/70 bg-muted/20 p-4"
                                      >
                                        <div className="grid gap-3 md:grid-cols-2">
                                          <div className="space-y-1.5">
                                            <Label htmlFor={`staff-ex-date-${idx}`}>
                                              {t("team.exceptionDateFromLabel")}
                                            </Label>
                                            <AppDatePicker
                                              id={`staff-ex-date-${idx}`}
                                              value={ex.exceptionDate}
                                              placeholder={t("team.exceptionDateFromLabel")}
                                              closeOnSelect
                                              onChange={(iso) =>
                                                updateException(idx, patchStaffExceptionOnFromChange(ex, iso))
                                              }
                                              className="h-11 rounded-xl"
                                            />
                                          </div>
                                          <div className="space-y-1.5">
                                            <Label htmlFor={`staff-ex-date-end-${idx}`}>
                                              {t("team.exceptionDateToLabel")}
                                            </Label>
                                            <AppDatePicker
                                              id={`staff-ex-date-end-${idx}`}
                                              value={ex.exceptionEndDate ?? ""}
                                              placeholder={t("team.exceptionDateToLabel")}
                                              min={
                                                /^\d{4}-\d{2}-\d{2}$/.test(ex.exceptionDate)
                                                  ? ex.exceptionDate
                                                  : undefined
                                              }
                                              closeOnSelect
                                              onChange={(iso) => {
                                                const from = ex.exceptionDate.trim().slice(0, 10)
                                                if (/^\d{4}-\d{2}-\d{2}$/.test(from) && iso < from) {
                                                  setNotice(t("team.exceptionEndBeforeStart"))
                                                  setNoticeDetail(null)
                                                  return
                                                }
                                                updateException(idx, { exceptionEndDate: iso })
                                              }}
                                              className="h-11 rounded-xl"
                                            />
                                          </div>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-[minmax(200px,1fr)_minmax(0,1fr)]">
                                          <div className="min-w-0 space-y-1.5">
                                            <Label htmlFor={`staff-ex-type-${idx}`}>
                                              {t("team.exceptionTypeLabel")}
                                            </Label>
                                            <Select
                                              value={ex.isClosed ? "closed" : "hours"}
                                              onValueChange={(v) =>
                                                updateException(idx, { isClosed: v === "closed" })
                                              }
                                            >
                                              <SelectTrigger id={`staff-ex-type-${idx}`} className="h-11 rounded-xl">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="closed">{t("team.exceptionTypeClosed")}</SelectItem>
                                                <SelectItem value="hours">{t("team.exceptionTypeSpecialHours")}</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        {!ex.isClosed ? (
                                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                                            <div className="space-y-1.5">
                                              <Label htmlFor={`staff-ex-start-${idx}`}>{t("team.timeFrom")}</Label>
                                              <Input
                                                id={`staff-ex-start-${idx}`}
                                                type="time"
                                                value={ex.startTime}
                                                onChange={(e) =>
                                                  updateException(idx, { startTime: e.target.value })
                                                }
                                                className="h-11 rounded-xl"
                                              />
                                            </div>
                                            <div className="space-y-1.5">
                                              <Label htmlFor={`staff-ex-end-${idx}`}>{t("team.timeTo")}</Label>
                                              <Input
                                                id={`staff-ex-end-${idx}`}
                                                type="time"
                                                value={ex.endTime}
                                                onChange={(e) =>
                                                  updateException(idx, { endTime: e.target.value })
                                                }
                                                className="h-11 rounded-xl"
                                              />
                                            </div>
                                          </div>
                                        ) : null}
                                        <div className="mt-3 space-y-1.5">
                                          <Label htmlFor={`staff-ex-reason-${idx}`}>
                                            {t("team.exceptionReasonLabel")}
                                          </Label>
                                          <Input
                                            id={`staff-ex-reason-${idx}`}
                                            value={ex.reason ?? ""}
                                            onChange={(e) => updateException(idx, { reason: e.target.value })}
                                            className="h-11 rounded-xl"
                                          />
                                        </div>
                                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 rounded-xl"
                                            disabled={saving}
                                            onClick={() => removeException(idx)}
                                          >
                                            {t("team.deleteException")}
                                          </Button>
                                          <Button
                                            type="button"
                                            className="h-10 rounded-xl"
                                            disabled={saving}
                                            onClick={() => void saveScheduleExceptionsAndCollapse()}
                                          >
                                            {t("team.saveException")}
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-xl"
                                    onClick={addException}
                                  >
                                    {t("team.addException")}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="mx-auto w-full max-w-[520px] min-w-0 space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3">
                            <div className="flex items-center justify-between">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 w-8 rounded-lg p-0"
                                onClick={() =>
                                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                                }
                                aria-label={language === "en" ? "Previous month" : "Poprzedni miesiąc"}
                              >
                                <ChevronLeft className="size-4" />
                              </Button>
                              <p className="text-sm font-medium capitalize text-foreground">{calendarMonthLabel}</p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 w-8 rounded-lg p-0"
                                onClick={() =>
                                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                                }
                                aria-label={language === "en" ? "Next month" : "Następny miesiąc"}
                              >
                                <ChevronRight className="size-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground">
                              {([1, 2, 3, 4, 5, 6, 0] as const).map((w) => (
                                <div key={`w-head-${w}`} className="text-center">
                                  {t(weekdayLabelKey(w)).slice(0, 2)}
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {calendarGridDays.map((day) => {
                                const iso = toIsoDateLocal(day)
                                const inMonth = day.getMonth() === calendarMonth.getMonth()
                                const holiday = calendarHolidaysByDay.get(iso)
                                const ex = calendarExceptionsByDay.get(iso)
                                const isToday = iso === toIsoDateLocal(new Date())
                                const isSelected = selectedCalendarDate === iso
                                const hasDayOff = Boolean(ex?.types.has("day_off"))
                                const hasSpecialHours = Boolean(ex?.types.has("special_hours"))
                                return (
                                  <button
                                    key={iso}
                                    type="button"
                                    onClick={() => setSelectedCalendarDate(iso)}
                                    className={`relative min-h-11 rounded-lg border p-1 text-xs transition ${
                                      isSelected
                                        ? "border-primary bg-[color:var(--nav-active-bg)]"
                                        : "border-border/70 bg-card"
                                    } ${!inMonth ? "opacity-45" : ""} ${isToday ? "ring-1 ring-primary/60" : ""}`}
                                    title={
                                      holiday
                                        ? language === "en"
                                          ? holiday.nameEn
                                          : holiday.namePl
                                        : undefined
                                    }
                                  >
                                    <span className="block text-left">{day.getDate()}</span>
                                    <span className="mt-1 flex gap-1">
                                      {holiday ? <span className="size-1.5 rounded-full bg-amber-400" /> : null}
                                      {hasDayOff ? <span className="size-1.5 rounded-full bg-rose-500" /> : null}
                                      {hasSpecialHours ? <span className="size-1.5 rounded-full bg-sky-400" /> : null}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <span className="size-2 rounded-full bg-amber-400" />
                                {t("team.holidayDayType")}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="size-2 rounded-full bg-rose-500" />
                                {t("team.exceptionTypeClosed")}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="size-2 rounded-full bg-sky-400" />
                                {t("team.exceptionTypeSpecialHours")}
                              </span>
                            </div>
                            {selectedCalendarDate ? (
                              <div className="rounded-xl border border-border/70 bg-card p-3 text-xs">
                                <p className="font-medium text-foreground">
                                  {language === "en" ? "Date" : "Data"}: {formatExceptionPreviewDate(selectedCalendarDate)}
                                </p>
                                {selectedDayException ? (
                                  <>
                                    <p className="mt-1 text-muted-foreground">
                                      {language === "en" ? "Type" : "Typ"}:{" "}
                                      {selectedDayException.types.has("day_off")
                                        ? t("team.exceptionTypeClosed")
                                        : t("team.exceptionTypeSpecialHours")}
                                    </p>
                                    {selectedDayException.types.has("special_hours") ? (
                                      <p className="mt-1 text-muted-foreground">
                                        {language === "en" ? "Hours" : "Godziny"}:{" "}
                                        {selectedDayException.exceptions
                                          .filter((x) => !x.isClosed)
                                          .map((x) => `${x.startTime}-${x.endTime}`)
                                          .join(", ")}
                                      </p>
                                    ) : null}
                                    {selectedDayException.exceptions.find((x) => (x.reason ?? "").trim()) ? (
                                      <p className="mt-1 text-muted-foreground">
                                        {t("team.exceptionReasonLabel")}:{" "}
                                        {(selectedDayException.exceptions.find((x) => (x.reason ?? "").trim())?.reason ?? "").trim()}
                                      </p>
                                    ) : null}
                                    {selectedDayHoliday ? (
                                      <p className="mt-1 text-muted-foreground">
                                        {t("team.holidayDayType")}:{" "}
                                        {language === "en" ? selectedDayHoliday.nameEn : selectedDayHoliday.namePl}
                                      </p>
                                    ) : null}
                                  </>
                                ) : selectedDayHoliday ? (
                                  <>
                                    <p className="mt-1 text-muted-foreground">
                                      {language === "en" ? "Type" : "Typ"}: {t("team.holidayDayType")}
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                      {language === "en" ? "Holiday name" : "Nazwa święta"}:{" "}
                                      {language === "en" ? selectedDayHoliday.nameEn : selectedDayHoliday.namePl}
                                    </p>
                                  </>
                                ) : (
                                  <p className="mt-1 text-muted-foreground">
                                    {language === "en" ? "No holiday or exception on this day." : "Brak święta i wyjątku w tym dniu."}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {language === "en"
                                  ? "Select a day to see details."
                                  : "Kliknij dzień w kalendarzu, aby zobaczyć szczegóły."}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {editing ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl"
                      disabled={saving}
                      onClick={handleGlobalCancelChanges}
                    >
                      {t("team.cancelChanges")}
                    </Button>
                    <Button type="submit" className="h-11 min-w-[140px] rounded-xl" disabled={saving}>
                      {t("team.saveChanges")}
                    </Button>
                  </div>
                ) : null}

                {!editing ? (
                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl sm:w-auto"
                      disabled={saving}
                      onClick={() => {
                        setForm(emptyForm())
                        setNotice(null)
                      }}
                    >
                      {t("team.clearForm")}
                    </Button>
                    <Button type="submit" className="h-11 w-full rounded-xl sm:min-w-[160px] sm:flex-1" disabled={saving}>
                      {submitLabel}
                    </Button>
                  </div>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    </AppShell>
  )
}
