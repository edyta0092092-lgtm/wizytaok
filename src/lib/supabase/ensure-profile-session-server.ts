import {
  prepareBusinessProfileForStartTrial,
  type PrepareBusinessProfileError,
} from "@/lib/start-trial/prepare-business-profile-server"

export type EnsureProfileSessionResult =
  | { ok: true; hadProfile: boolean; created: boolean }
  | {
      ok: false
      error:
        | "unauthorized"
        | "no_server"
        | "service_role_required"
        | "incomplete_user_metadata"
        | "profile_insert_failed"
    }

function mapPrepareFailure(error: PrepareBusinessProfileError): EnsureProfileSessionResult {
  switch (error) {
    case "unauthorized":
      return { ok: false, error: "unauthorized" }
    case "no_server":
      return { ok: false, error: "no_server" }
    case "missing_service_role_key":
      return { ok: false, error: "service_role_required" }
    case "missing_account_type":
    case "missing_slug_or_business_name":
    case "missing_company_tax_id":
    case "missing_contact_phone":
      return { ok: false, error: "incomplete_user_metadata" }
    default:
      return { ok: false, error: "profile_insert_failed" }
  }
}

/**
 * @deprecated Prefer prepareBusinessProfileForStartTrial — ta funkcja zachowana dla POST /api/auth/ensure-business-profile.
 */
export async function ensureBusinessProfileForSessionUser(): Promise<EnsureProfileSessionResult> {
  const r = await prepareBusinessProfileForStartTrial()
  if (r.ok) {
    return {
      ok: true,
      hadProfile: !r.created,
      created: r.created || r.updated,
    }
  }
  return mapPrepareFailure(r.error)
}
