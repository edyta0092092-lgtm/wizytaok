#!/usr/bin/env node
/**
 * Weryfikuje konfigurację Google Calendar i otwiera panele Google / Supabase.
 * Użycie: node scripts/setup-google-calendar.mjs [--open]
 */
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

const ROOT = path.resolve(import.meta.dirname, "..")
const ENV_PATH = path.join(ROOT, ".env.local")
const OPEN_LINKS = process.argv.includes("--open")

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const out = {}
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function normalizeSupabaseUrl(raw) {
  if (!raw) return null
  return raw.trim().replace(/\/rest\/v1\/?$/i, "")
}

function extractProjectRef(url) {
  const match = String(url).match(/https?:\/\/([^.]+)\.supabase\.co/i)
  return match?.[1] ?? null
}

function statusLine(ok, label, detail = "") {
  const icon = ok ? "✓" : "○"
  const suffix = detail ? ` — ${detail}` : ""
  console.log(`${icon} ${label}${suffix}`)
}

function openUrl(url) {
  if (!OPEN_LINKS) return
  const cmd = process.platform === "win32" ? "cmd" : "open"
  const args =
    process.platform === "win32"
      ? ["/c", "start", "", url]
      : process.platform === "darwin"
        ? [url]
        : [url]
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref()
}

async function probeDatabase(anonKey, baseUrl) {
  if (!anonKey || !baseUrl) return null
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/rest/v1/google_calendar_connections?select=id&limit=1`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      },
    )
    if (res.status === 200) return true
    const text = await res.text()
    if (res.status === 404 || text.includes("PGRST205")) return false
    return null
  } catch {
    return null
  }
}

async function main() {
  const env = parseEnvFile(ENV_PATH)
  const supabaseUrl = normalizeSupabaseUrl(
    env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  )
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const projectRef = extractProjectRef(supabaseUrl ?? "")

  const oauthId = (env.GOOGLE_CALENDAR_CLIENT_ID ?? "").trim()
  const oauthSecret = (env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "").trim()
  const encryptionKey = (env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY ?? "").trim()
  const serviceRole = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()

  const oauthOk = Boolean(oauthId && oauthSecret)
  const encryptionOk = encryptionKey.length >= 32
  const serviceRoleOk = Boolean(serviceRole)
  const dbOk = await probeDatabase(anonKey, supabaseUrl)

  console.log("\nGoogle Calendar — konfiguracja lokalna\n")
  console.log(`Plik: ${ENV_PATH}\n`)

  statusLine(oauthOk, "GOOGLE_CALENDAR_CLIENT_ID + SECRET")
  statusLine(encryptionOk, "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY (min. 32 zn.)")
  statusLine(serviceRoleOk, "SUPABASE_SERVICE_ROLE_KEY")
  statusLine(dbOk === true, "Migracja SQL (tabela google_calendar_connections)", dbOk === false ? "brak tabeli" : dbOk === null ? "nie sprawdzono" : "wdrożona")

  const localRedirect = "http://localhost:3000/api/integrations/google-calendar/callback"
  const prodRedirect = "https://wizytaok.vercel.app/api/integrations/google-calendar/callback"

  console.log("\nRedirect URI (Google Cloud OAuth Client → Web):\n")
  console.log(`  ${localRedirect}`)
  console.log(`  ${prodRedirect}`)

  console.log("\nPanele (dodaj --open aby otworzyć w przeglądarce):\n")

  const calendarApiUrl =
    "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
  const credentialsUrl = "https://console.cloud.google.com/apis/credentials"
  const supabaseApiUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/settings/api`
    : "https://supabase.com/dashboard/projects"

  console.log(`  Calendar API: ${calendarApiUrl}`)
  console.log(`  OAuth credentials: ${credentialsUrl}`)
  console.log(`  Supabase API keys: ${supabaseApiUrl}`)

  openUrl(calendarApiUrl)
  openUrl(credentialsUrl)
  openUrl(supabaseApiUrl)

  console.log("\n--- Publikacja dla wszystkich użytkowników (Google) ---\n")
  console.log("1. OAuth consent screen → External, nazwa, logo, e-mail wsparcia")
  console.log("2. Privacy policy URL: https://wizytaok.pl/privacy")
  console.log("3. Terms URL: https://wizytaok.pl/terms")
  console.log("4. Authorized domains: wizytaok.pl (+ vercel.app jeśli używasz)")
  console.log("5. Publish app → Submit for verification (scope kalendarza)")
  console.log("6. Po akceptacji Google każdy użytkownik może kliknąć Połącz\n")

  if (!oauthOk || !serviceRoleOk) {
    console.log("\nUzupełnij brakujące wartości w .env.local, potem zrestartuj `npm run dev`.")
    console.log("Te same zmienne dodaj w Vercel → Project → Settings → Environment Variables.\n")
  } else if (dbOk !== true) {
    console.log(
      "\nUruchom migrację: supabase/migrations/100_google_calendar_integration.sql w Supabase SQL Editor.\n",
    )
  } else {
    console.log("\nKonfiguracja kompletna. Wejdź na /settings/integrations i kliknij „Połącz Google Calendar”.\n")
  }

  process.exit(oauthOk && encryptionOk && serviceRoleOk && dbOk === true ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
