import type { Metadata } from "next"

import { BRAND } from "@/config/brand"

export const metadata: Metadata = {
  title: "Rezerwacje i potwierdzenia wizyt",
  description: `${BRAND.name} - prosty system rezerwacji, automatyczne przypomnienia i potwierdzanie wizyt dla małych firm usługowych. 30 dni za darmo.`,
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children
}
