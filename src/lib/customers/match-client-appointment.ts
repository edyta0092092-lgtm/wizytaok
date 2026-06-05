import { normalizeEmail, normalizePhone } from "@/lib/clients/normalize"
import type { Appointment, Client } from "@/types/domain"

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "")
}

function normalizeEmailLower(email: string): string {
  return email.trim().toLowerCase()
}

/** Czy wizyta należy do rekordu klienta (jak w katalogu /clients). */
export function appointmentBelongsToClient(appt: Appointment, client: Client): boolean {
  if (appt.clientId && appt.clientId === client.id) return true

  const ap = normalizePhone(appt.phone)
  const rp = normalizePhone(client.phone)
  if (ap && rp && ap === rp) return true

  const ae = normalizeEmail(String(appt.email ?? ""))
  const re = normalizeEmail(String(client.email ?? ""))
  if (re && ae && ae === re) return true

  const dig = normalizePhoneDigits(appt.phone)
  const rdig = normalizePhoneDigits(client.phone)
  if (rdig.length >= 6 || dig.length >= 6) return rdig.length >= 6 && dig === rdig

  const aeLegacy = normalizeEmailLower(String(appt.email ?? ""))
  const reLegacy = normalizeEmailLower(String(client.email ?? ""))
  if (reLegacy.includes("@")) return aeLegacy !== "" && aeLegacy === reLegacy

  const nameLc = String(appt.clientName ?? "").trim().toLowerCase()
  const clientNameLc = client.fullName.trim().toLowerCase()
  return nameLc !== "" && nameLc === clientNameLc && dig === rdig && rdig !== ""
}
