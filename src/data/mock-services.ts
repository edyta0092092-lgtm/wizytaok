import type { Service } from "@/types/domain"

export const initialServicesList: Service[] = [
  {
    id: "svc-1",
    name: "Konsultacja",
    description: "Szybka konsultacja i wstępna kwalifikacja",
    durationMinutes: 60,
    price: 150,
    isActive: true,
  },
  {
    id: "svc-2",
    name: "Zabieg podstawowy",
    description: "Podstawowy zabieg w pakiecie",
    durationMinutes: 90,
    price: 250,
    isActive: true,
  },
  {
    id: "svc-3",
    name: "Kontrola",
    description: "Krótka kontrola po wizycie",
    durationMinutes: 30,
    price: 80,
    isActive: false,
  },
  {
    id: "svc-4",
    name: "Pierwsza wizyta",
    description: "Pierwsze spotkanie i omówienie potrzeb",
    durationMinutes: 75,
    price: 200,
    isActive: true,
  },
]

