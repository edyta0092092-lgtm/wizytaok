"use client"

import { usePreferences } from "@/lib/preferences/preferences-provider"

export function useTranslations() {
  const { t, language, theme, setLanguage, setTheme } = usePreferences()
  return { t, language, theme, setLanguage, setTheme }
}

