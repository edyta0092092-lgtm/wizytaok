import { DEFAULT_BREAK_MINUTES_NONE_VALUE } from "@/lib/services/service-break-options"

export const SETTINGS_STORAGE_KEY = "pw_settings_form_v2"

export type SettingsForm = {
  businessName: string
  businessAddress: string
  businessAddressPlaceId: string
  publicSlug: string
  email: string
  phoneDialCode: string
  phoneNational: string
  taxId: string
  taxIdEntryEnabled: boolean
  depositForNewClients: boolean
  depositForAllClients: boolean
  depositAmount: string
  defaultBreakMinutes: string
}

export const demoSettings: SettingsForm = {
  businessName: "Studio WizytaOK",
  businessAddress: "ul. Przykładowa 1, 00-001 Warszawa",
  businessAddressPlaceId: "",
  publicSlug: "rezerwacje",
  email: "kontakt@example.pl",
  phoneDialCode: "+48",
  phoneNational: "600000000",
  taxId: "",
  taxIdEntryEnabled: false,
  depositForNewClients: false,
  depositForAllClients: false,
  depositAmount: "50",
  defaultBreakMinutes: DEFAULT_BREAK_MINUTES_NONE_VALUE,
}

export const emptySettings: SettingsForm = {
  businessName: "",
  businessAddress: "",
  businessAddressPlaceId: "",
  publicSlug: "",
  email: "",
  phoneDialCode: "+48",
  phoneNational: "",
  taxId: "",
  taxIdEntryEnabled: false,
  depositForNewClients: false,
  depositForAllClients: false,
  depositAmount: "",
  defaultBreakMinutes: DEFAULT_BREAK_MINUTES_NONE_VALUE,
}
