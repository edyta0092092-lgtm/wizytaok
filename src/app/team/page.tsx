"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Copy, Plus, Search, Trash2, Users } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { MobileFixedActionBar } from "@/components/mobile/mobile-fixed-action-bar"
import { AccessDenied } from "@/components/shared/access-denied"
import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
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
import { scrollFocusedFieldIntoView } from "@/lib/mobile/scroll-focused-field-into-view"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getLocalServices, getServices } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import {
  addStaffMember,
  getStaffAvailabilityContextForBusiness,
  getStaffMembers,
  getStaffServiceIds,
  loadServiceIdsByStaffMap,
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
import { cn } from "@/lib/utils"

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

function formatTeamMemberCount(count: number, language: string, t: (key: string) => string): string {
  if (language === "en") {
    return count === 1
      ? t("team.memberCountOneEn")
      : t("team.memberCountOtherEn").replace("{count}", String(count))
  }
  if (count === 1) return t("team.memberCountOne")
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return t("team.memberCountFew").replace("{count}", String(count))
  }
  return t("team.memberCountMany").replace("{count}", String(count))
}

type TeamFieldErrors = {
  firstName?: string
  email?: string
  phone?: string
  panelRole?: string
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

function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
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

function findExceptionIndexForDate(exceptions: StaffAvailabilityExceptionInput[], date: string): number {
  for (let i = 0; i < exceptions.length; i++) {
    const range = normalizeExceptionRange(exceptions[i]!)
    if (!range) continue
    if (date >= range.from && date <= range.to) return i
  }
  return -1
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
  const [fieldErrors, setFieldErrors] = React.useState<TeamFieldErrors>({})
  const [exceptionFieldErrors, setExceptionFieldErrors] = React.useState<Record<number, string>>({})
  const [scheduleValidated, setScheduleValidated] = React.useState(false)
  const [editing, setEditing] = React.useState<StaffMember | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [panelInvites, setPanelInvites] = React.useState<PanelInviteRow[]>([])
  const [serviceIdsByStaff, setServiceIdsByStaff] = React.useState<Record<string, string[]>>({})
  const [inviteHighlightId, setInviteHighlightId] = React.useState<string | null>(null)
  const [isScheduleEditing, setIsScheduleEditing] = React.useState(false)
  const [highlightedExceptionIndex, setHighlightedExceptionIndex] = React.useState<number | null>(null)
  const exceptionCardRefs = React.useRef<Map<number, HTMLDivElement>>(new Map())
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
  const [mobileFormOpen, setMobileFormOpen] = React.useState(false)
  const isStaffServiceOnboarding = flowActive && activeStepId === "staff_service"
  const staffServiceTourNeedsPerson = isStaffServiceOnboarding && !editing
  const staffServiceTourNeedsServicesTab =
    isStaffServiceOnboarding && Boolean(editing) && formTab !== "services"
  const staffServiceTourNeedsServiceChoice =
    isStaffServiceOnboarding && Boolean(editing) && formTab === "services"

  const formTabOptions = React.useMemo(() => {
    const options: Array<{
      value: "profile" | "panel" | "services" | "schedule" | "exceptions"
      labelKey: string
    }> = [{ value: "profile", labelKey: "team.mobileFormTabProfile" }]
    if (access.canManageInvitations) {
      options.push({ value: "panel", labelKey: "team.mobileFormTabPanel" })
    }
    options.push(
      { value: "services", labelKey: "team.mobileFormTabServices" },
      { value: "schedule", labelKey: "team.mobileFormTabSchedule" },
      { value: "exceptions", labelKey: "team.mobileFormTabExceptions" },
    )
    return options
  }, [access.canManageInvitations])

  const setFormTabSafe = (value: string) => {
    const allowed =
      value === "panel" || value === "services" || value === "schedule" || value === "exceptions"
        ? value
        : "profile"
    setFormTab(allowed)
  }

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

  React.useEffect(() => {
    if (highlightedExceptionIndex == null) return
    const el = exceptionCardRefs.current.get(highlightedExceptionIndex)
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [highlightedExceptionIndex, form.exceptions.length])

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

    const nextMap = client && bid ? await loadServiceIdsByStaffMap(client, bid, rows.map((x) => x.id)) : {}
    setServiceIdsByStaff(nextMap)
    if (Object.values(nextMap).some((ids) => ids.length > 0)) {
      window.dispatchEvent(new Event("pw-staff-services-saved"))
    }

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

  const closeMobileForm = () => {
    setMobileFormOpen(false)
    if (!editing) {
      setForm(emptyForm())
      setFieldErrors({})
      setExceptionFieldErrors({})
    }
  }

  const resetFormToCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setInviteHighlightId(null)
    setIsScheduleEditing(false)
    setHighlightedExceptionIndex(null)
    setFieldErrors({})
    setExceptionFieldErrors({})
    setScheduleValidated(false)
    setFormTab("profile")
    setMobileFormOpen(true)
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
      setHighlightedExceptionIndex(null)
    } else {
      restoreFormFromSavedSnapshot()
      setIsScheduleEditing(false)
      setHighlightedExceptionIndex(null)
    }
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
    setHighlightedExceptionIndex(null)
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
    setHighlightedExceptionIndex(null)
    setFieldErrors({})
    setExceptionFieldErrors({})
    setScheduleValidated(false)
  }

  const beginEdit = (staff: StaffMember) => {
    if (isStaffServiceOnboarding) {
      setFormTab("profile")
    }
    setMobileFormOpen(true)
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
    setScheduleValidated(false)
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)),
    }))
  }

  const addException = (seedDate?: string) => {
    const seedRaw = (seedDate ?? selectedCalendarDate ?? "").trim().slice(0, 10)
    const seed = /^\d{4}-\d{2}-\d{2}$/.test(seedRaw) ? seedRaw : ""
    setForm((prev) => {
      const nextIndex = prev.exceptions.length
      setHighlightedExceptionIndex(nextIndex)
      return {
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
      }
    })
    if (seed) {
      const [y, m] = seed.split("-").map(Number)
      setCalendarMonth(new Date(y, m - 1, 1))
      setSelectedCalendarDate(seed)
    }
  }

  const updateException = (index: number, patch: Partial<StaffAvailabilityExceptionInput>) => {
    setExceptionFieldErrors((prev) => {
      if (!prev[index]) return prev
      const next = { ...prev }
      delete next[index]
      return next
    })
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
    setHighlightedExceptionIndex((prev) => {
      if (prev == null) return null
      if (prev === index) return null
      if (prev > index) return prev - 1
      return prev
    })
  }

  const validateScheduleExceptionsList = (exceptions: StaffAvailabilityExceptionInput[]): boolean => {
    const nextErrors: Record<number, string> = {}
    for (let i = 0; i < exceptions.length; i++) {
      const ex = exceptions[i]!
      const date = ex.exceptionDate.trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        nextErrors[i] = t("team.exceptionStartDateRequired")
        break
      }
      const endDate = (ex.exceptionEndDate ?? "").trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        nextErrors[i] = t("team.exceptionEndDateRequired")
        break
      }
      if (endDate < date) {
        nextErrors[i] = t("team.exceptionEndBeforeStart")
        break
      }
      if (
        !ex.isClosed &&
        (!ex.startTime.trim() || !ex.endTime.trim() || toMinutes(ex.endTime) <= toMinutes(ex.startTime))
      ) {
        nextErrors[i] = t("team.validationExceptionHoursRequired")
        break
      }
    }
    setExceptionFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const validateForm = (): boolean => {
    const firstName = form.firstName.trim()
    const name = joinPersonName(form.firstName, form.lastName)
    const emailTrim = form.email.trim()
    const nationalDigits = form.phoneNational.replace(/\D/g, "")
    const next: TeamFieldErrors = {}

    if (!firstName || !name) {
      next.firstName = t("team.validationFirstNameRequired")
    }
    if (emailTrim && !EMAIL_RE.test(emailTrim)) {
      next.email = t("team.validationEmailInvalid")
    }
    if (nationalDigits) {
      const v = validateNationalPhoneLength(form.phoneDialCode, form.phoneNational)
      if (!v.ok) {
        next.phone = t("team.validationPhoneInvalid")
      }
    }
    if (access.canManageInvitations && !emailTrim) {
      next.email = t("team.validationEmailRequiredForInvite")
    }
    if (form.panelMemberRole !== "admin" && form.panelMemberRole !== "staff") {
      next.panelRole = t("team.validationPanelRoleRequired")
    }

    setFieldErrors(next)
    if (Object.keys(next).length > 0) {
      setNoticeDetail(null)
      if (next.firstName || next.email || next.phone) {
        setFormTab("profile")
      } else if (next.panelRole) {
        setFormTab("panel")
      }
      return false
    }
    return true
  }

  const validateScheduleRulesForSave = (): boolean => {
    if (form.useBusinessHours) return true
    setScheduleValidated(true)
    for (const rule of form.rules) {
      if (!rule.isAvailable) continue
      if (!rule.startTime?.trim() || !rule.endTime?.trim()) {
        setFormTab("schedule")
        setNoticeDetail(null)
        return false
      }
      if (!isScheduleTimeRangeValid(rule.startTime, rule.endTime)) {
        setFormTab("schedule")
        setNoticeDetail(null)
        return false
      }
    }
    return true
  }

  const validateScheduleExceptionAt = (index: number): boolean => {
    const ex = form.exceptions[index]
    if (!ex) return false
    const date = ex.exceptionDate.trim().slice(0, 10)
    let message: string | null = null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      message = t("team.exceptionStartDateRequired")
    } else {
      const endDate = (ex.exceptionEndDate ?? "").trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        message = t("team.exceptionEndDateRequired")
      } else if (endDate < date) {
        message = t("team.exceptionEndBeforeStart")
      } else if (
        !ex.isClosed &&
        (!ex.startTime.trim() || !ex.endTime.trim() || toMinutes(ex.endTime) <= toMinutes(ex.startTime))
      ) {
        message = t("team.validationExceptionHoursRequired")
      }
    }
    setExceptionFieldErrors((prev) => {
      const next = { ...prev }
      delete next[index]
      if (message) next[index] = message
      return next
    })
    if (message) {
      setFormTab("exceptions")
      return false
    }
    return true
  }

  const saveScheduleExceptions = async () => {
    setNoticeDetail(null)
    if (!validateScheduleExceptionsList(form.exceptions)) {
      setFormTab("exceptions")
      return
    }

    if (editing && isSupabaseConfigured()) {
      const client = getBrowserClient()
      const bid = businessProfileId ?? access.businessId
      if (!client || !bid) {
        setNotice(t("team.noBusinessProfile"))
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
        setNotice(t("team.scheduleExceptionsSaved"))
        setNoticeDetail(null)
      } finally {
        setSaving(false)
      }
      return
    }

    setSavedExceptionsState(form.exceptions.map((ex) => ({ ...ex })))
    setNotice(t("team.scheduleExceptionsSaved"))
    setNoticeDetail(null)
    setExceptionFieldErrors({})
  }

  const performSave = async () => {
    setNoticeDetail(null)
    if (!validateForm()) return
    if (!validateScheduleRulesForSave()) return
    setFieldErrors({})
    setScheduleValidated(false)
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
        setNotice(t("team.noBusinessProfile"))
        setNoticeDetail(null)
        return
      }
      if (!businessProfileId && bid) {
        setBusinessProfileId(bid)
      }
      let partialNotices: string[] = []
      const msgAllSaved = t("team.changesSaved")
      const msgPartialSaved = t("team.partialSaved")
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
          return `${line} (${detail.trim()})`
        }
        setNoticeDetail(null)
        return line
      }
      const panelAccessNoticeForSuccess = (panelRes: {
        invitationToken: string | null
        alreadyHasPanelAccess?: boolean
        emailOutcome?: "sent" | "not_configured" | "failed"
        emailDetail?: string
        membershipWarning?: string | null
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
          if (panelRes.emailOutcome === "failed" && panelRes.emailDetail?.trim()) {
            setNoticeDetail(`${t("team.errorDetailsPrefix")} ${panelRes.emailDetail.trim()}`)
          } else if (panelRes.membershipWarning?.trim()) {
            setNoticeDetail(`${t("team.errorDetailsPrefix")} ${panelRes.membershipWarning.trim()}`)
            notices.push(t("invitations.invitationEmailSentAcceptLink"))
          } else if (panelRes.emailOutcome !== "failed") {
            setNoticeDetail(null)
          }
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
        if (form.serviceIds.length > 0) {
          window.dispatchEvent(new Event("pw-staff-services-saved"))
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
          const panelRes = await requestPanelAccessForStaff(newStaffId, form.email, form.panelMemberRole, {
            sendEmail: true,
            resetPassword: true,
          })
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
      let syncRoleHasLinkedPanel = false
      if (bid && isSupabaseConfigured() && emailTrim) {
        try {
          const syncRes = await fetch("/api/team/sync-member-role", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              staffMemberId: editing.id,
              panelMemberRole: form.panelMemberRole,
              invitationEmail: emailTrim,
            }),
          })
          const syncJson = (await syncRes.json().catch(() => null)) as {
            ok?: boolean
            hasLinkedPanel?: boolean
            error?: string
          } | null
          if (syncJson?.ok) {
            syncRoleHasLinkedPanel = syncJson.hasLinkedPanel === true
          } else if (process.env.NODE_ENV === "development" && syncJson?.error) {
            console.warn("[team] sync-member-role:", syncJson.error)
          }
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[team] sync-member-role failed", err)
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
      if (form.serviceIds.length > 0) {
        window.dispatchEvent(new Event("pw-staff-services-saved"))
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
      const roleChangedOnEdit = form.panelMemberRole !== savedProfileState.panelMemberRole
      if (roleChangedOnEdit) {
        partialNotices = [...partialNotices, t("team.panelRoleUpdated")]
      }
      await load()
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
      setHighlightedExceptionIndex(null)
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
    try {
      const res = await fetch("/api/team/remove-staff-member", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffMemberId: staffId }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        if (json?.error === "cannot_remove_owner") {
          setNotice(t("team.deleteOwnerBlocked"))
        } else {
          setNotice(t("team.deleteError"))
          if (json?.error?.trim()) {
            setNoticeDetail(`${t("team.errorDetailsPrefix")} ${json.error.trim()}`)
          }
        }
        return
      }
      if (editing?.id === staffId) resetFormToCreate()
      await load()
      setNotice(t("team.deleted"))
      setNoticeDetail(null)
    } catch {
      setNotice(t("team.deleteError"))
    }
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
    options?: { sendEmail?: boolean; resetPassword?: boolean },
  ): Promise<
    | {
        ok: true
        invitationToken: string | null
        alreadyHasPanelAccess?: boolean
        emailOutcome?: InvitationEmailSendOutcome
        emailDetail?: string
        membershipWarning?: string | null
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
          sendEmail: options?.sendEmail !== false,
          resetPassword: options?.resetPassword === true,
        }),
      })
      if (!res.ok) {
        const jsonErr = (await res.json().catch(() => null)) as {
          messageKey?: string
          detail?: string | null
          error?: string
        } | null
        const serverError = typeof jsonErr?.error === "string" ? jsonErr.error : undefined
        return {
          ok: false,
          messageKey:
            jsonErr?.messageKey ??
            (serverError === "supabase_unconfigured"
              ? "team.invitationServerNotConfigured"
              : "invitations.invitationCreateError"),
          detail:
            jsonErr?.detail ??
            serverError ??
            `http_${res.status}`,
          serverError,
        }
      }
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        invitationToken?: string | null
        messageKey?: string
        detail?: string | null
        error?: string
        alreadyHasPanelAccess?: boolean
        email?: {
          sent?: boolean
          code?: string
          detail?: string | null
          membershipWarning?: string | null
        }
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
      let emailDetail: string | undefined
      if (token) {
        if (json.email?.sent) {
          emailOutcome = "sent"
        } else if (
          json.email?.code === "not_configured" ||
          json.email?.code === "simulated_dev"
        ) {
          emailOutcome = "not_configured"
          emailDetail = json.email?.detail?.trim() || json.email?.code
        } else if (json.email?.code) {
          emailOutcome = "failed"
          emailDetail = json.email?.detail?.trim() || json.email?.code
        }
      }
      return {
        ok: true,
        invitationToken: token,
        alreadyHasPanelAccess: json.alreadyHasPanelAccess === true,
        emailOutcome,
        emailDetail,
        membershipWarning: json.email?.membershipWarning ?? null,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network_error"
      return { ok: false, messageKey: "invitations.invitationCreateError", detail: msg }
    }
  }

  const sendPanelInvitationOnly = async () => {
    if (!editing?.id) return
    const emailTrim = form.email.trim()
    if (!emailTrim) {
      setNotice(t("team.panelEmailRequired"))
      setNoticeDetail(null)
      return
    }
    if (!EMAIL_RE.test(emailTrim)) {
      setNotice(t("team.validationEmailInvalid"))
      setNoticeDetail(null)
      return
    }
    setSaving(true)
    setNoticeDetail(null)
    try {
      const panelRes = await requestPanelAccessForStaff(
        editing.id,
        emailTrim,
        form.panelMemberRole,
      )
      if (!panelRes.ok) {
        let key = "invitations.invitationCreateError"
        if (panelRes.messageKey === "team.panelEmailRequired") key = "team.panelEmailRequired"
        else if (panelRes.messageKey === "team.panelInviteEmailConflict") {
          key = "team.panelInviteEmailConflict"
        } else if (panelRes.messageKey === "team.panelInviteOwnerEmail") {
          key = "team.panelInviteOwnerEmail"
        } else if (panelRes.messageKey === "team.invitationServerNotConfigured") {
          key = "team.invitationServerNotConfigured"
        } else if (panelRes.messageKey) key = panelRes.messageKey
        const line = t(key as "team.panelEmailRequired")
        if (panelRes.detail?.trim()) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${panelRes.detail.trim()}`)
          setNotice(`${line} (${panelRes.detail.trim()})`)
        } else {
          setNotice(line)
        }
        return
      }
      if (panelRes.alreadyHasPanelAccess) {
        setNotice(t("team.panelRoleUpdated"))
        setNoticeDetail(null)
      } else if (panelRes.invitationToken) {
        const emailLine =
          panelRes.emailOutcome === "sent"
            ? t("invitations.invitationEmailSent")
            : panelRes.emailOutcome === "not_configured"
              ? t("invitations.invitationEmailNotConfigured")
              : panelRes.emailOutcome === "failed"
                ? t("invitations.invitationEmailFailed")
                : t("invitations.invitationCreated")
        setNotice(emailLine)
        if (panelRes.emailOutcome === "failed" && panelRes.emailDetail?.trim()) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${panelRes.emailDetail.trim()}`)
        } else if (panelRes.membershipWarning?.trim()) {
          setNoticeDetail(`${t("team.errorDetailsPrefix")} ${panelRes.membershipWarning.trim()}`)
        } else {
          setNoticeDetail(null)
        }
        setSidebarTab("invites")
      } else {
        setNotice(t("invitations.invitationCreateError"))
      }
      await load()
      if (panelRes.ok && panelRes.invitationToken) {
        const bid = businessProfileId ?? access.businessId
        const client = getBrowserClient()
        if (client && bid && isSupabaseConfigured()) {
          const { data: invRow } = await client
            .from("business_invitations")
            .select("id")
            .eq("business_id", bid)
            .eq("token", panelRes.invitationToken)
            .eq("status", "pending")
            .maybeSingle()
          if (invRow?.id) setInviteHighlightId(invRow.id as string)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const sendInvitationEmailByToken = async (
    token: string,
  ): Promise<{
    outcome: InvitationEmailSendOutcome
    detail?: string
    membershipWarning?: string | null
  }> => {
    try {
      const res = await fetch("/api/team/send-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, language }),
      })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        detail?: string | null
        membershipWarning?: string | null
      } | null
      if (json?.ok) {
        return {
          outcome: "sent",
          membershipWarning: json.membershipWarning ?? null,
        }
      }
      const err = json?.error
      const detail = json?.detail ?? undefined
      if (err === "not_configured" || err === "simulated_dev") {
        return { outcome: "not_configured", detail }
      }
      if (err === "provision_failed") {
        return {
          outcome: "failed",
          detail: detail ?? t("invitations.invitationEmailProvisionFailed"),
        }
      }
      return { outcome: "failed", detail: detail ?? err }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network_error"
      return { outcome: "failed", detail: msg }
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
    const { outcome, detail, membershipWarning } = await sendInvitationEmailByToken(token)
    await load()
    const line = invitationEmailNoticeForOutcome(outcome)
    if (line) {
      if (detail?.trim() && outcome === "failed") {
        setNoticeDetail(`${t("team.errorDetailsPrefix")} ${detail.trim()}`)
        setNotice(line)
      } else if (outcome === "sent" && membershipWarning?.trim()) {
        setNoticeDetail(`${t("team.errorDetailsPrefix")} ${membershipWarning.trim()}`)
        setNotice(t("invitations.invitationEmailSentAcceptLink"))
      } else if (outcome === "not_configured") {
        setNoticeDetail(detail?.trim() ? `${t("team.errorDetailsPrefix")} ${detail.trim()}` : null)
        setNotice(line)
      } else {
        setNoticeDetail(null)
        setNotice(line)
      }
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    setPanelInvites((prev) => prev.filter((inv) => inv.id !== invitationId))
    if (inviteHighlightId === invitationId) setInviteHighlightId(null)
    try {
      const res = await fetch("/api/team/invitations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        await load()
        setNotice(t("invitations.invitationCreateError"))
        return
      }
      setNotice(t("invitations.cancelled"))
      setNoticeDetail(null)
    } catch {
      await load()
      setNotice(t("invitations.invitationCreateError"))
    }
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
    ? livePersonName || t("team.edit")
    : t("team.addPersonCard")
  const formCardDescription = editing
    ? t("team.edit")
    : t("team.emailHelp")
  const submitLabel = editing ? t("team.saveChanges") : t("team.save")
  const showSchedulePreview = Boolean(editing) && !isScheduleEditing
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
          <div className="mb-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
            <p>{notice}</p>
            {noticeDetail ? <p className="mt-1.5 text-xs text-muted-foreground">{noticeDetail}</p> : null}
          </div>
        ) : null}

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] xl:items-start">
          <div
            className={cn(
              "flex min-w-0 flex-col gap-5 xl:sticky xl:top-6",
              mobileFormOpen && "hidden xl:flex",
            )}
          >
            <Card
              data-tour={staffServiceTourNeedsPerson ? "team-staff-service-target" : undefined}
              className="min-w-0 overflow-hidden rounded-2xl border border-border shadow-sm shadow-slate-900/5"
            >
              <CardHeader className="space-y-4 border-b border-border/60 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {t("team.teamMembersTitle")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {loading ? t("team.loading") : formatTeamMemberCount(items.length, language, t)}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-11 shrink-0 touch-manipulation rounded-xl px-3 xl:h-9"
                    onClick={() => resetFormToCreate()}
                  >
                    <Plus className="size-4" aria-hidden />
                    <span className="hidden sm:inline">{t("team.addPersonCard")}</span>
                    <span className="sm:hidden">{t("team.add")}</span>
                  </Button>
                </div>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="team-staff-search"
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    placeholder={t("team.searchPlaceholder")}
                    className="h-11 touch-manipulation rounded-xl pl-9 xl:h-10"
                    aria-label={t("team.searchAriaLabel")}
                  />
                </div>
                <Tabs
                  value={sidebarTab}
                  onValueChange={(v) => setSidebarTab(v === "invites" ? "invites" : "members")}
                  className="w-full"
                >
                  <TabsList variant="line" className="h-auto w-full justify-start gap-1 p-0">
                    <TabsTrigger
                      value="members"
                      className="h-11 min-h-11 flex-1 touch-manipulation rounded-lg px-2 text-xs sm:text-sm xl:h-9 xl:min-h-0"
                    >
                      {t("team.teamMembersTitle")}
                    </TabsTrigger>
                    {access.ready && access.canManageInvitations ? (
                      <TabsTrigger
                        value="invites"
                        className="h-11 min-h-11 flex-1 touch-manipulation rounded-lg px-2 text-xs sm:text-sm xl:h-9 xl:min-h-0"
                      >
                        {t("team.pendingInvitationsTitle")}
                        {pendingInvites.length > 0 ? (
                          <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                            {pendingInvites.length}
                          </span>
                        ) : null}
                      </TabsTrigger>
                    ) : null}
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="min-w-0 px-3 py-3 sm:px-4">
                <Tabs value={sidebarTab} className="w-full">
                  <TabsContent value="members" className="mt-0">
                    <div className="premium-scrollbar space-y-2 xl:max-h-[min(52vh,32rem)] xl:overflow-y-auto xl:pr-0.5">
                      {loading ? <p className="px-1 py-2 text-sm text-muted-foreground">{t("team.loading")}</p> : null}
                      {!loading && staffLoadError ? (
                        <p className="px-1 py-2 text-sm text-destructive">
                          {t("team.loadMembersError")}
                        </p>
                      ) : null}
                      {!loading && !staffLoadError && items.length === 0 ? (
                        <div className="px-1 py-6 text-center">
                          <p className="text-sm text-muted-foreground">{t("team.teamMembersEmpty")}</p>
                          <Button
                            type="button"
                            className="mt-4 h-11 touch-manipulation rounded-xl xl:hidden"
                            onClick={() => resetFormToCreate()}
                          >
                            <Plus className="size-4" aria-hidden />
                            {t("team.addPersonCard")}
                          </Button>
                        </div>
                      ) : null}
                      {!loading && !staffLoadError && items.length > 0 && filteredStaff.length === 0 ? (
                        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                          {t("team.noSearchResults")}
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
                          const displayName = getStaffDisplayName(staff)
                          const isSelected = editing?.id === staff.id
                          return (
                            <button
                              key={staff.id}
                              type="button"
                              onClick={() => beginEdit(staff)}
                              className={`w-full touch-manipulation rounded-xl border p-3.5 text-left text-sm transition-colors xl:p-3 ${
                                isSelected
                                  ? "border-primary/50 bg-[color:var(--nav-active-bg)] shadow-sm"
                                  : "border-border/70 bg-card hover:border-border hover:bg-muted/25"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                    isSelected
                                      ? "bg-primary/15 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                  aria-hidden
                                >
                                  {staffInitials(displayName)}
                                </span>
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="truncate font-semibold text-foreground">{displayName}</p>
                                    <span
                                      className={semanticStatusBadgeClass(
                                        staff.isActive ? "success" : "neutral",
                                        "shrink-0 px-2 py-0.5 text-[11px] font-medium",
                                      )}
                                    >
                                      {staff.isActive ? t("team.active") : t("services.hiddenStatus")}
                                    </span>
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground xl:hidden">
                                    {staffRoleLabel}
                                    {svcNames ? ` · ${svcNames}` : ` · ${t("team.noServicesAssigned")}`}
                                  </p>
                                  <p className="hidden truncate text-xs text-muted-foreground xl:block">
                                    {(staff.email ?? "").trim() || "—"}
                                  </p>
                                  <p className="hidden truncate text-xs text-muted-foreground xl:block">
                                    {(staff.phone ?? "").trim() || "—"}
                                  </p>
                                  <p className="hidden truncate text-xs text-muted-foreground xl:block">
                                    {t("team.panelRole")}:{" "}
                                    <span className="text-foreground/80">{staffRoleLabel}</span>
                                  </p>
                                  <p className="hidden truncate text-xs text-muted-foreground xl:block">
                                    {t("team.servicesShort")}:{" "}
                                    <span className="text-foreground/80">
                                      {svcNames || t("team.noServicesAssigned")}
                                    </span>
                                  </p>
                                </div>
                                <ChevronRight
                                  className="size-4 shrink-0 text-muted-foreground xl:hidden"
                                  aria-hidden
                                />
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </TabsContent>

                  {access.ready && access.canManageInvitations ? (
                    <TabsContent value="invites" className="mt-0">
                      <div className="premium-scrollbar space-y-3 xl:max-h-[min(52vh,32rem)] xl:overflow-y-auto xl:pr-0.5">
                        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                          {t("invitations.pendingInvitationsEmailHint")}
                        </p>
                        {pendingInvites.length === 0 ? (
                          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                            {t("team.pendingInvitationsEmpty")}
                          </p>
                        ) : (
                          <ul className="space-y-2">
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
                                    ? "border-primary/50 bg-[color:var(--nav-active-bg)] shadow-sm"
                                    : "border-border/70 bg-card"
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
                      </div>
                    </TabsContent>
                  ) : null}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div
            className={cn(
              "min-w-0",
              !mobileFormOpen && "hidden xl:block",
              mobileFormOpen && "pb-mobile-sticky-page",
            )}
            onFocusCapture={(e) => scrollFocusedFieldIntoView(e.target)}
          >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-3 h-11 w-fit touch-manipulation rounded-xl xl:hidden"
            onClick={closeMobileForm}
          >
            <ChevronLeft className="mr-1 size-4" aria-hidden />
            {t("team.mobileBackToList")}
          </Button>
          <Card
            data-tour="team-person-form"
            className="min-w-0 overflow-hidden rounded-2xl border border-border shadow-sm shadow-slate-900/5"
          >
            <CardHeader className="space-y-0 border-b border-border/60 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-lg">{formCardTitle}</CardTitle>
                  <CardDescription>{formCardDescription}</CardDescription>
                </div>
                {editing ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!editing.isActive ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl"
                        onClick={() => void activateStaff(editing)}
                      >
                        {t("team.activate")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => void remove(editing.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {t("common.delete")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="min-w-0 px-4 py-5 sm:px-6">
              <form
                id="team-person-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void performSave()
                }}
                className="min-w-0 space-y-6"
              >
                <Tabs value={formTab} onValueChange={setFormTabSafe} className="min-w-0 w-full">
                  <div className="min-w-0 pb-3 xl:hidden">
                    <Label htmlFor="team-form-section-mobile" className="sr-only">
                      {t("team.mobileFormSectionLabel")}
                    </Label>
                    <Select value={formTab} onValueChange={setFormTabSafe}>
                      <SelectTrigger
                        id="team-form-section-mobile"
                        className="h-11 w-full touch-manipulation rounded-xl"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formTabOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="hidden min-w-0 border-b border-border/70 pb-1 xl:block">
                    <TabsList
                      variant="line"
                      className="h-auto w-full flex-wrap justify-start gap-x-0.5 gap-y-1 p-0"
                    >
                      <TabsTrigger
                        value="profile"
                        className="h-9 max-w-full shrink-0 rounded-lg px-3 text-sm"
                      >
                        {t("team.personDetailsSection")}
                      </TabsTrigger>
                      {access.canManageInvitations ? (
                        <TabsTrigger value="panel" className="h-9 max-w-full shrink-0 rounded-lg px-3 text-sm">
                          {t("team.panelAccessSection")}
                        </TabsTrigger>
                      ) : null}
                      <TabsTrigger
                        value="services"
                        className="h-9 max-w-full shrink-0 rounded-lg px-3 text-sm"
                        data-tour={
                          staffServiceTourNeedsServicesTab
                            ? "team-staff-service-target"
                            : "team-services-tab"
                        }
                      >
                        {t("team.servicesForStaff")}
                      </TabsTrigger>
                      <TabsTrigger value="schedule" className="h-9 max-w-full shrink-0 rounded-lg px-3 text-sm">
                        {t("team.schedule")}
                      </TabsTrigger>
                      <TabsTrigger value="exceptions" className="h-9 max-w-full shrink-0 rounded-lg px-3 text-sm">
                        {t("team.scheduleExceptionsTitle")}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="profile" className="mt-6 space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="staff-first-name">{t("team.firstName")}</Label>
                        <Input
                          id="staff-first-name"
                          value={form.firstName}
                          onChange={(e) => {
                            setFieldErrors((prev) => ({ ...prev, firstName: undefined }))
                            setForm((f) => ({ ...f, firstName: e.target.value }))
                          }}
                          className="h-10 rounded-xl"
                          aria-invalid={Boolean(fieldErrors.firstName)}
                          autoComplete="given-name"
                        />
                        {fieldErrors.firstName ? (
                          <p className="text-xs text-destructive" role="alert">
                            {fieldErrors.firstName}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-last-name">{t("team.lastName")}</Label>
                        <Input
                          id="staff-last-name"
                          value={form.lastName}
                          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                          className="h-10 rounded-xl"
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                    <InternationalPhoneFieldGroup
                      label={t("team.phone")}
                      dialCode={form.phoneDialCode}
                      nationalDigits={form.phoneNational}
                      onDialCodeChange={(v) => {
                        setFieldErrors((prev) => ({ ...prev, phone: undefined }))
                        setForm((f) => ({ ...f, phoneDialCode: v }))
                      }}
                      onNationalChange={(digits) => {
                        setFieldErrors((prev) => ({ ...prev, phone: undefined }))
                        setForm((f) => ({ ...f, phoneNational: digits }))
                      }}
                      dialSelectId="staff-phone-dial"
                      nationalInputId="staff-phone"
                      showInlineError={!fieldErrors.phone}
                    />
                    {fieldErrors.phone ? (
                      <p className="text-xs text-destructive" role="alert">
                        {fieldErrors.phone}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="staff-email">{t("team.contactEmail")}</Label>
                      <Input
                        id="staff-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => {
                          setFieldErrors((prev) => ({ ...prev, email: undefined }))
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }}
                        className="h-10 rounded-xl"
                        aria-invalid={Boolean(fieldErrors.email)}
                        autoComplete="email"
                      />
                      {fieldErrors.email ? (
                        <p className="text-xs text-destructive" role="alert">
                          {fieldErrors.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3.5">
                      <div className="space-y-0.5">
                        <Label htmlFor="staff-active">{t("team.active")}</Label>
                        <p className="text-xs text-muted-foreground">{t("team.inactiveBookingHint")}</p>
                      </div>
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
                          onValueChange={(v) => {
                            setFieldErrors((prev) => ({ ...prev, panelRole: undefined }))
                            setForm((f) => ({
                              ...f,
                              panelMemberRole: v === "admin" ? "admin" : "staff",
                            }))
                          }}
                        >
                          <SelectTrigger id="panel-member-role" className="h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">{t("invitations.staffRoleOption")}</SelectItem>
                            <SelectItem value="admin">{t("invitations.adminRoleOption")}</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldErrors.panelRole ? (
                          <p className="text-xs text-destructive" role="alert">
                            {fieldErrors.panelRole}
                          </p>
                        ) : null}
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
                        {editing ? (
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {t("team.panelRoleChangeNoInviteHint")}
                          </p>
                        ) : null}
                      </div>
                      {editing ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-11 w-full rounded-xl"
                          disabled={saving || !form.email.trim()}
                          onClick={() => void sendPanelInvitationOnly()}
                        >
                          {t("invitations.sendInvitation")}
                        </Button>
                      ) : null}
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
                                    const hoursMissing =
                                      rule.isAvailable &&
                                      (!rule.startTime?.trim() || !rule.endTime?.trim())
                                    const rowInvalid =
                                      scheduleValidated &&
                                      rule.isAvailable &&
                                      (hoursMissing ||
                                        !isScheduleTimeRangeValid(rule.startTime, rule.endTime))
                                    const rowErrorMessage = hoursMissing
                                      ? t("team.fillAvailableDayHours")
                                      : t("team.invalidTimeRange")
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
                                            <p className="text-xs text-destructive">{rowErrorMessage}</p>
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
                      <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                        <p className="text-sm text-muted-foreground">{t("team.scheduleExceptionsHint")}</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                          <li>{t("team.scheduleExceptionsStep1")}</li>
                          <li>{t("team.scheduleExceptionsStep2")}</li>
                          <li>{t("team.scheduleExceptionsStep3")}</li>
                        </ol>
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
                            aria-label={t("team.calendarPrevMonth")}
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
                            aria-label={t("team.calendarNextMonth")}
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
                                onClick={() => {
                                  setSelectedCalendarDate(iso)
                                  const idx = findExceptionIndexForDate(form.exceptions, iso)
                                  setHighlightedExceptionIndex(idx >= 0 ? idx : null)
                                  if (
                                    day.getMonth() !== calendarMonth.getMonth() ||
                                    day.getFullYear() !== calendarMonth.getFullYear()
                                  ) {
                                    setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1))
                                  }
                                }}
                                className={cn(
                                  "relative min-h-11 rounded-lg border p-1 text-xs transition",
                                  isSelected
                                    ? "border-primary bg-[color:var(--nav-active-bg)]"
                                    : "border-border/70 bg-card",
                                  !inMonth && "opacity-45",
                                  isToday && "ring-1 ring-primary/60",
                                )}
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
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
                          <p className="text-[11px] text-muted-foreground">{t("team.calendarHolidayInfoOnly")}</p>
                        </div>
                        {selectedCalendarDate ? (
                          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3 text-xs">
                            <p className="font-medium text-foreground">
                              {formatExceptionPreviewDate(selectedCalendarDate)}
                            </p>
                            {selectedDayHoliday ? (
                              <p className="text-muted-foreground">
                                {t("team.holidayDayType")}:{" "}
                                {language === "en" ? selectedDayHoliday.nameEn : selectedDayHoliday.namePl}
                              </p>
                            ) : null}
                            {selectedDayException ? (
                              <>
                                <p className="text-muted-foreground">
                                  {selectedDayException.types.has("day_off")
                                    ? t("team.exceptionTypeClosed")
                                    : t("team.exceptionTypeSpecialHours")}
                                  {selectedDayException.types.has("special_hours")
                                    ? ` · ${selectedDayException.exceptions
                                        .filter((x) => !x.isClosed)
                                        .map((x) => `${x.startTime}–${x.endTime}`)
                                        .join(", ")}`
                                    : null}
                                </p>
                                <p className="text-muted-foreground">{t("team.exceptionListedBelow")}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-muted-foreground">{t("team.calendarNoStaffException")}</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 rounded-lg"
                                  onClick={() => addException(selectedCalendarDate)}
                                >
                                  {t("team.addExceptionForDay")}
                                </Button>
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t("team.calendarSelectDayHint")}</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{t("team.exceptionsListTitle")}</p>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl"
                            onClick={() => addException()}
                          >
                            {t("team.addException")}
                          </Button>
                        </div>
                        {form.exceptions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t("team.scheduleExceptionsEmpty")}</p>
                        ) : (
                          <div className="space-y-4">
                            {form.exceptions.map((ex, idx) => (
                              <div
                                key={`${idx}-${ex.exceptionDate}-${ex.exceptionEndDate ?? ""}`}
                                ref={(el) => {
                                  if (el) exceptionCardRefs.current.set(idx, el)
                                  else exceptionCardRefs.current.delete(idx)
                                }}
                                className={cn(
                                  "rounded-xl border border-border/70 bg-muted/20 p-4 transition",
                                  highlightedExceptionIndex === idx && "border-primary ring-1 ring-primary/30",
                                )}
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
                                          setExceptionFieldErrors((prev) => ({
                                            ...prev,
                                            [idx]: t("team.exceptionEndBeforeStart"),
                                          }))
                                          return
                                        }
                                        updateException(idx, { exceptionEndDate: iso })
                                      }}
                                      className="h-11 rounded-xl"
                                    />
                                  </div>
                                </div>
                                <div className="mt-3 space-y-1.5">
                                  <Label className="text-xs">{t("team.exceptionTypeLabel")}</Label>
                                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-background/80 p-0.5">
                                    {(
                                      [
                                        { value: true, label: t("team.exceptionTypeClosed") },
                                        { value: false, label: t("team.exceptionTypeSpecialHours") },
                                      ] as const
                                    ).map((option) => (
                                      <button
                                        key={option.value ? "closed" : "hours"}
                                        type="button"
                                        onClick={() => updateException(idx, { isClosed: option.value })}
                                        className={cn(
                                          "h-9 rounded-md px-2 text-center text-[11px] font-medium leading-tight transition-colors",
                                          ex.isClosed === option.value
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                        )}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
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
                                        onChange={(e) => updateException(idx, { startTime: e.target.value })}
                                        className="h-11 rounded-xl"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`staff-ex-end-${idx}`}>{t("team.timeTo")}</Label>
                                      <Input
                                        id={`staff-ex-end-${idx}`}
                                        type="time"
                                        value={ex.endTime}
                                        onChange={(e) => updateException(idx, { endTime: e.target.value })}
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
                                    placeholder={t("team.exceptionReasonPlaceholder")}
                                    onChange={(e) => updateException(idx, { reason: e.target.value })}
                                    className="h-11 rounded-xl"
                                  />
                                </div>
                                {exceptionFieldErrors[idx] ? (
                                  <p className="mt-3 text-xs text-destructive" role="alert">
                                    {exceptionFieldErrors[idx]}
                                  </p>
                                ) : null}
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
                                    onClick={() => {
                                      if (!validateScheduleExceptionAt(idx)) return
                                      void saveScheduleExceptions()
                                    }}
                                  >
                                    {t("team.saveException")}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">{t("team.scheduleExceptionsSaveFooterHint")}</p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {editing ? (
                  <div className="mt-6 hidden min-w-0 flex-col-reverse gap-3 border-t border-border/70 bg-muted/15 pt-4 xl:flex xl:flex-row xl:items-center xl:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full shrink-0 rounded-xl sm:w-auto"
                      disabled={saving}
                      onClick={handleGlobalCancelChanges}
                    >
                      {t("team.cancelChanges")}
                    </Button>
                    <Button
                      type="submit"
                      className="h-11 w-full shrink-0 rounded-xl sm:w-auto"
                      disabled={saving}
                    >
                      {t("team.saveChanges")}
                    </Button>
                  </div>
                ) : null}

                {!editing ? (
                  <div className="mt-6 hidden min-w-0 flex-col-reverse gap-3 border-t border-border/70 bg-muted/15 pt-4 xl:flex xl:flex-row xl:items-center xl:justify-between xl:gap-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 w-full shrink-0 rounded-xl text-muted-foreground sm:w-auto"
                      disabled={saving}
                      onClick={() => {
                        setForm(emptyForm())
                        setNotice(null)
                      }}
                    >
                      {t("team.clearForm")}
                    </Button>
                    <Button
                      type="submit"
                      className="h-11 w-full max-w-full shrink-0 rounded-xl sm:w-auto"
                      disabled={saving}
                    >
                      {submitLabel}
                    </Button>
                  </div>
                ) : null}
              </form>
            </CardContent>
          </Card>

          {mobileFormOpen ? (
            <MobileFixedActionBar>
              {editing ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    form="team-person-form"
                    className="h-11 w-full touch-manipulation rounded-xl"
                    disabled={saving}
                  >
                    {saving ? t("common.saving") : t("team.saveChanges")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full touch-manipulation rounded-xl"
                    disabled={saving}
                    onClick={handleGlobalCancelChanges}
                  >
                    {t("team.cancelChanges")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    form="team-person-form"
                    className="h-11 w-full touch-manipulation rounded-xl"
                    disabled={saving}
                  >
                    {saving ? t("common.saving") : submitLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full touch-manipulation rounded-xl text-muted-foreground"
                    disabled={saving}
                    onClick={() => {
                      setForm(emptyForm())
                      setNotice(null)
                    }}
                  >
                    {t("team.clearForm")}
                  </Button>
                </div>
              )}
            </MobileFixedActionBar>
          ) : null}
          </div>
        </div>
      </PageShell>
    </AppShell>
  )
}
