import type { Appointment, DashboardMetrics } from "@/types/domain"

export const mockDashboardMetrics: DashboardMetrics = {
  visitsToday: 14,
  visitsTomorrow: 11,
  confirmedCount: 9,
  potentialNoShows: 3,
}

export const mockUpcomingAppointments: Appointment[] = [
  {
    id: "a5",
    clientName: "Ewa Mazur",
    phone: "+48 601 222 333",
    serviceLabel: "Kontrola",
    startsAt: "2026-04-27T09:00:00",
    status: "pending",
    noShowRisk: "none",
  },
  {
    id: "a1",
    clientName: "Anna Kowalska",
    phone: "+48 501 234 567",
    serviceLabel: "Konsultacja",
    startsAt: "2026-04-27T10:00:00",
    status: "confirmed",
    noShowRisk: "none",
  },
  {
    id: "a2",
    clientName: "Piotr Nowak",
    phone: "+48 602 111 222",
    serviceLabel: "Zabieg podstawowy",
    startsAt: "2026-04-27T11:30:00",
    status: "booked",
    noShowRisk: "medium",
  },
  {
    id: "a3",
    clientName: "Magdalena Wiśniewska",
    phone: "+48 793 444 555",
    serviceLabel: "Pierwsza wizyta",
    startsAt: "2026-04-27T14:00:00",
    status: "booked",
    noShowRisk: "high",
  },
  {
    id: "a4",
    clientName: "Tomasz Zieliński",
    phone: "+48 881 000 321",
    serviceLabel: "Przegląd",
    startsAt: "2026-04-27T16:15:00",
    status: "confirmed",
    noShowRisk: "low",
  },
]
