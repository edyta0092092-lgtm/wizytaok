import { redirect } from "next/navigation"

/** Legacy route — CRM lives at /klienci. */
export default function ClientsRedirectPage() {
  redirect("/klienci")
}
