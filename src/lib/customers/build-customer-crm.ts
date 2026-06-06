import { appointmentBelongsToClient } from "@/lib/customers/match-client-appointment"
import { computeCustomerSegment } from "@/lib/customers/customer-segment"
import { splitCustomerName } from "@/lib/customers/customer-name"
import type { CustomerCrmRow, CustomerKpis, CustomerVisitRow } from "@/lib/customers/customer-types"
import type { Appointment, Client } from "@/types/domain"

function isUpcomingVisit(startsAt: string, now: Date): boolean {
  const t = new Date(startsAt).getTime()
  return Number.isFinite(t) && t >= now.getTime()
}

function isPastVisit(startsAt: string, now: Date): boolean {
  const t = new Date(startsAt).getTime()
  return Number.isFinite(t) && t < now.getTime()
}

function buildVisitsForClient(client: Client, appointments: Appointment[]): CustomerVisitRow[] {
  const matched = appointments
    .filter((a) => appointmentBelongsToClient(a, client))
    .map((a) => ({
      id: `vh-${a.id}`,
      appointmentId: a.id,
      startsAt: a.startsAt,
      serviceLabel: a.serviceLabel.trim() || "—",
      staffName: (a.staffName?.trim() || "").length > 0 ? a.staffName!.trim() : "—",
      status: a.status,
    }))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())

  if (matched.length > 0) return matched

  return client.visitHistory.map((v) => ({
    id: v.id,
    appointmentId: v.appointmentId,
    startsAt: v.startsAt,
    serviceLabel: v.serviceLabel,
    staffName: "—",
    status: v.status,
  }))
}

function visitTimestamps(visits: CustomerVisitRow[], now: Date) {
  const sorted = [...visits].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const firstVisitAt = sorted[0]?.startsAt ?? null

  const past = sorted.filter(
    (v) => isPastVisit(v.startsAt, now) || v.status === "completed" || v.status === "no_show",
  )
  const lastVisitAt = past.length > 0 ? past[past.length - 1]!.startsAt : null

  const upcoming = sorted.filter(
    (v) =>
      isUpcomingVisit(v.startsAt, now) &&
      v.status !== "cancelled" &&
      v.status !== "completed" &&
      v.status !== "no_show",
  )
  const nextVisitAt = upcoming[0]?.startsAt ?? null

  return { firstVisitAt, lastVisitAt, nextVisitAt }
}

export function buildCustomerCrmRow(
  client: Client,
  appointments: Appointment[],
  now: Date = new Date(),
): CustomerCrmRow {
  const visits = buildVisitsForClient(client, appointments)
  const { firstName, lastName } = splitCustomerName(client.fullName)
  const { firstVisitAt, lastVisitAt, nextVisitAt } = visitTimestamps(visits, now)

  let completedCount = 0
  let cancelledCount = 0
  let noShowCount = 0
  for (const v of visits) {
    if (v.status === "completed") completedCount += 1
    if (v.status === "cancelled") cancelledCount += 1
    if (v.status === "no_show") noShowCount += 1
  }

  const visitCount = visits.length > 0 ? visits.length : client.visitCount
  if (visits.length === 0) {
    completedCount = client.confirmedVisitCount
    cancelledCount = client.cancelledVisitCount
    noShowCount = client.noShowCount
  }

  const segment = computeCustomerSegment({
    visitCount,
    lastVisitAt,
    nextVisitAt,
    now,
  })

  return {
    id: client.id,
    fullName: client.fullName,
    firstName,
    lastName,
    phone: client.phone,
    email: client.email,
    visitCount,
    completedCount,
    cancelledCount,
    noShowCount,
    lastVisitAt,
    nextVisitAt,
    firstVisitAt,
    segment,
    visits,
    notes: client.notes?.trim() ? client.notes.trim() : undefined,
    attachments: client.attachments ?? [],
  }
}

export function buildCustomerCrmRows(clients: Client[], appointments: Appointment[]): CustomerCrmRow[] {
  const now = new Date()
  return clients
    .map((c) => buildCustomerCrmRow(c, appointments, now))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pl", { sensitivity: "base" }))
}

export function buildCustomerKpis(rows: CustomerCrmRow[], now: Date = new Date()): CustomerKpis {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let newThisMonth = 0
  let returning = 0
  let lost = 0

  for (const row of rows) {
    if (row.segment === "returning") returning += 1
    if (row.segment === "lost") lost += 1
    if (row.firstVisitAt) {
      const first = new Date(row.firstVisitAt)
      if (first >= monthStart && first <= now) newThisMonth += 1
    }
  }

  return {
    totalCustomers: rows.length,
    newThisMonth,
    returning,
    lost,
  }
}
