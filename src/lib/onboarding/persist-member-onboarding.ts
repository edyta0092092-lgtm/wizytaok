import type { SupabaseClient } from "@supabase/supabase-js"

import {
  clearMemberOnboardingRecord,
  emptyMemberOnboardingRecord,
  loadMemberOnboardingRecord,
  mergeMemberOnboardingRecord,
  saveMemberOnboardingRecord,
  type MemberOnboardingRecord,
  type MemberOnboardingPatch,
} from "@/lib/onboarding/member-onboarding-db"
import type { OnboardingStepsMeta } from "@/lib/onboarding/onboarding-state-meta"
import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"
import {
  getOnboardingStepIds,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"

export type UserOnboardingFlags = {
  welcomeDismissed: boolean
  completed: boolean
  restartPending: boolean
}

export type PanelOnboardingState = {
  record: MemberOnboardingRecord
  slug: string | null
  bookingPath: string | null
}

export function recordToFlags(record: MemberOnboardingRecord): UserOnboardingFlags {
  return {
    welcomeDismissed: record.welcomeDismissed,
    completed: record.completed,
    restartPending: record.meta.restartPending,
  }
}

async function fetchBookingMeta(
  client: SupabaseClient,
  businessId: string,
): Promise<{ slug: string | null; bookingPath: string | null }> {
  const bid = businessId.trim()
  const { data: bp } = await client
    .from("business_profiles")
    .select("slug")
    .eq("id", bid)
    .maybeSingle()

  const slug = typeof bp?.slug === "string" ? bp.slug.trim() : ""
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : ""
  const bookingPath =
    slug && origin ? `${origin}/rezerwacje/${encodeURIComponent(slug)}` : null

  return { slug: slug || null, bookingPath }
}

/** Jedno lekkie odczytanie stanu z bazy (bez synchronizacji kroków z całej firmy). */
export async function loadPanelOnboardingState(
  client: SupabaseClient,
  scope: OnboardingScope,
  businessId: string,
): Promise<PanelOnboardingState> {
  const [record, booking] = await Promise.all([
    loadMemberOnboardingRecord(client, scope),
    fetchBookingMeta(client, businessId),
  ])
  return { record, ...booking }
}

export async function persistPanelOnboarding(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
  patch: MemberOnboardingPatch,
): Promise<MemberOnboardingRecord> {
  if (!client) return mergeMemberOnboardingRecord(current, patch)
  return saveMemberOnboardingRecord(client, scope, current, patch)
}

export async function persistOnboardingWelcomeDismissed(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
): Promise<MemberOnboardingRecord> {
  return persistPanelOnboarding(client, scope, current, { welcomeDismissed: true })
}

export async function persistOnboardingComplete(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
): Promise<MemberOnboardingRecord> {
  return persistPanelOnboarding(client, scope, current, {
    completed: true,
    meta: { restartPending: false },
  })
}

export async function persistOnboardingStepComplete(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
  stepId: OnboardingStepId,
): Promise<MemberOnboardingRecord> {
  return persistPanelOnboarding(client, scope, current, {
    steps: { [stepId]: true },
  })
}

export async function persistOnboardingResumeStep(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
  stepId: OnboardingStepId | null,
): Promise<MemberOnboardingRecord> {
  return persistPanelOnboarding(client, scope, current, {
    meta: { resumeStepId: stepId },
  })
}

function resetProgressPatch(
  scope: OnboardingScope,
  options: { restartPending: boolean },
): MemberOnboardingPatch {
  const first = getOnboardingStepIds(scope.track === "admin")[0] ?? null
  return {
    welcomeDismissed: false,
    completed: false,
    resetSteps: true,
    steps: {},
    meta: { resumeStepId: first, restartPending: options.restartPending },
  }
}

/** Reset postępu bez otwierania welcome (karta / modal „Rozpocznij od nowa”). */
export async function persistOnboardingResetProgress(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
): Promise<MemberOnboardingRecord> {
  const cleared = emptyMemberOnboardingRecord()
  const patch = resetProgressPatch(scope, { restartPending: false })
  if (!client) {
    return mergeMemberOnboardingRecord(cleared, patch)
  }
  return saveMemberOnboardingRecord(client, scope, cleared, patch)
}

export async function persistOnboardingRestartRequest(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
): Promise<MemberOnboardingRecord> {
  const cleared = emptyMemberOnboardingRecord()
  const patch = resetProgressPatch(scope, { restartPending: true })
  if (!client) {
    return mergeMemberOnboardingRecord(cleared, patch)
  }
  return saveMemberOnboardingRecord(client, scope, cleared, patch)
}

export async function consumeOnboardingRestartPending(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
): Promise<{ pending: boolean; record: MemberOnboardingRecord }> {
  if (!current.meta.restartPending) {
    return { pending: false, record: current }
  }
  const next = await persistPanelOnboarding(client, scope, current, {
    meta: { restartPending: false },
  })
  return { pending: true, record: next }
}

export async function persistOnboardingRestart(
  client: SupabaseClient | null,
  scope: OnboardingScope,
): Promise<MemberOnboardingRecord> {
  if (!client) return emptyMemberOnboardingRecord()
  return clearMemberOnboardingRecord(client, scope)
}

export { emptyMemberOnboardingRecord, type MemberOnboardingRecord, type OnboardingStepsMeta }
