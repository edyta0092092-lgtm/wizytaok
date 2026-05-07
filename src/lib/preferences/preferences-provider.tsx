"use client"

import * as React from "react"

import { dictionaries, type Language, type Theme } from "@/lib/i18n/dictionaries"

type PreferencesContextValue = {
  language: Language
  theme: Theme
  setLanguage: (language: Language) => void
  setTheme: (theme: Theme) => void
  t: (key: string) => string
}

const PreferencesContext = React.createContext<PreferencesContextValue | null>(
  null
)

const STORAGE_KEYS = {
  language: "pw_language",
  theme: "pw_theme",
} as const

function getFromStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function setInStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

function getNestedStringValue(dict: unknown, key: string): string | null {
  const parts = key.split(".")
  let cur: unknown = dict
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return null
    const rec = cur as Record<string, unknown>
    cur = rec[p]
  }
  return typeof cur === "string" ? cur : null
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("pl")
  const [theme, setThemeState] = React.useState<Theme>("light")
  const [isHydrated, setIsHydrated] = React.useState(false)

  const setLanguage = React.useCallback((next: Language) => {
    setLanguageState(next)
  }, [])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
  }, [])

  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      const storedLang = getFromStorage(STORAGE_KEYS.language)
      const storedTheme = getFromStorage(STORAGE_KEYS.theme)

      if (storedLang === "en" || storedLang === "pl") {
        setLanguageState(storedLang)
      }
      if (storedTheme === "dark" || storedTheme === "light") {
        setThemeState(storedTheme)
        applyThemeToDom(storedTheme)
      } else {
        applyThemeToDom("light")
      }
      setIsHydrated(true)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  React.useEffect(() => {
    if (!isHydrated) return
    setInStorage(STORAGE_KEYS.language, language)
  }, [isHydrated, language])

  React.useEffect(() => {
    if (!isHydrated) return
    setInStorage(STORAGE_KEYS.theme, theme)
    applyThemeToDom(theme)
  }, [isHydrated, theme])

  const t = React.useCallback(
    (key: string) => {
      const dict = dictionaries[language]
      return getNestedStringValue(dict, key) ?? key
    },
    [language]
  )

  const value = React.useMemo<PreferencesContextValue>(
    () => ({ language, theme, setLanguage, setTheme, t }),
    [language, theme, setLanguage, setTheme, t]
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = React.useContext(PreferencesContext)
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider")
  }
  return ctx
}

