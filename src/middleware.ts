import { NextResponse, type NextRequest } from "next/server"

import { safeInternalRedirect } from "@/lib/auth/safe-internal-redirect"
import {
  billingRecoveryRedirectPath,
  resolveBusinessPanelAccess,
} from "@/lib/auth/resolve-business-panel-access"
import { isStaffForbiddenPanelPath } from "@/lib/auth/panel-route-access"
import {
  isAuthRequiredPanelPath,
  isOperationalPanelPath,
} from "@/lib/auth/panel-paths"
import {
  changePasswordRequiredUrl,
  isChangePasswordExemptPath,
  userMustChangePassword,
} from "@/lib/auth/must-change-password"
import {
  isClientAccountUser,
  isClientPortalLoginPath,
  isClientPortalPath,
} from "@/lib/client-portal/client-portal-auth"
import { updateSession } from "@/lib/supabase/middleware"
import { isSupabaseConfigured } from "@/lib/supabase/server"

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  if (pathname === "/pricing") return true
  if (pathname === "/login") return true
  if (pathname === "/signup") return true
  if (pathname === "/signup-staff") return true
  if (pathname === "/terms") return true
  if (pathname === "/privacy") return true
  if (pathname === "/developer-contact") return true
  if (pathname === "/rezerwacje") return true
  if (pathname.startsWith("/rezerwacje/")) return true
  if (pathname.startsWith("/book/")) return true
  if (pathname.startsWith("/confirm/")) return true
  if (pathname.startsWith("/auth/")) return true
  if (pathname.startsWith("/accept-invite/")) return true
  if (pathname === "/start-trial") return true
  if (pathname === "/subscription-required") return true
  if (pathname === "/activate-access") return true
  if (isClientPortalLoginPath(pathname)) return true
  return false
}

async function userIsActiveBusinessMember(
  supabase: Awaited<ReturnType<typeof updateSession>>["supabase"],
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("business_members")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()
  return Boolean(data?.id)
}

function isSettingsStripeReturnPath(searchParams: URLSearchParams): boolean {
  const stripeTest = searchParams.get("stripe_test")
  if (stripeTest === "success" || stripeTest === "cancel") return true
  const stripePaid = searchParams.get("stripe_paid")
  if (stripePaid === "success" || stripePaid === "cancel") return true
  return false
}

function isSettingsBillingRecoveryPath(searchParams: URLSearchParams): boolean {
  return searchParams.get("billing") === "required"
}

function normalizeSlugForRewrite(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  // dopuszczamy tylko bezpieczne znaki na slug, by uniknąć directory traversal
  if (!/^[a-z0-9-]+$/i.test(trimmed)) return null
  return trimmed.toLowerCase()
}

function redirectToBillingRecovery(request: NextRequest, path: string): NextResponse {
  const url = new URL(path, request.url)
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
  if (path.startsWith("/settings")) {
    url.searchParams.set("next", returnTo)
  }
  return NextResponse.redirect(url)
}

function isSettingsSetupPath(pathname: string, searchParams: URLSearchParams): boolean {
  return pathname.startsWith("/settings") && searchParams.has("setup")
}

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request })
  }

  const { response, user, supabase } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // Czysty URL /rezerwacje — wewnętrznie wybieramy slug i renderujemy
  // /rezerwacje/[businessSlug] przez `rewrite` (URL w pasku pozostaje /rezerwacje).
  // Priorytety: query ?firma=…  →  slug zalogowanego właściciela.
  if (pathname === "/rezerwacje") {
    const querySlug = normalizeSlugForRewrite(request.nextUrl.searchParams.get("firma"))
    let target: string | null = querySlug
    if (!target && user) {
      try {
        const { data } = await supabase
          .from("business_profiles")
          .select("slug")
          .eq("owner_id", user.id)
          .maybeSingle()
        target = normalizeSlugForRewrite(data?.slug ?? null)
      } catch {
        target = null
      }
    }
    if (target) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/rezerwacje/${target}`
      return NextResponse.rewrite(rewriteUrl)
    }
    // Brak rozpoznanej firmy — pozwalamy fallback page'owi /rezerwacje obsłużyć błąd.
    return response
  }

  if (isClientPortalPath(pathname) && !isClientPortalLoginPath(pathname)) {
    if (!user) {
      const loginUrl = new URL("/konto/logowanie", request.url)
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(loginUrl)
    }
    if (!isClientAccountUser(user)) {
      const isMember = await userIsActiveBusinessMember(supabase, user.id)
      if (isMember) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
      return NextResponse.redirect(
        new URL("/konto/logowanie?error=client_account_required", request.url),
      )
    }
    return response
  }

  if (isClientPortalLoginPath(pathname) && user && isClientAccountUser(user)) {
    return NextResponse.redirect(new URL("/konto", request.url))
  }

  if (isPublicPath(pathname)) {
    if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/signup-staff")) {
      const staffInvite =
        user.user_metadata?.staff_invite === true ||
        user.user_metadata?.staff_invite === "true"
      const isSignupTrial = pathname === "/signup" && request.nextUrl.searchParams.get("startTrial") === "true"
      const nextPath = safeInternalRedirect(
        request.nextUrl.searchParams.get("next") ??
          request.nextUrl.searchParams.get("redirectTo"),
      )
      let afterLogin = isSignupTrial ? "/start-trial" : (nextPath ?? "/dashboard")
      if (staffInvite && pathname === "/login") {
        const access = await resolveBusinessPanelAccess(supabase, user.id, user.email, {
          staffInvite: true,
        })
        if (!access.businessId) {
          afterLogin = "/settings?setup=business"
        } else if (!access.hasActiveAccess) {
          afterLogin = access.canManageBilling ? "/activate-access" : "/subscription-required"
        }
      }
      return NextResponse.redirect(new URL(afterLogin, request.url))
    }
    return response
  }

  if (user && userMustChangePassword(user) && !isChangePasswordExemptPath(pathname)) {
    const requiredUrl = new URL(changePasswordRequiredUrl(request.nextUrl.pathname), request.url)
    return NextResponse.redirect(requiredUrl)
  }

  if (isAuthRequiredPanelPath(pathname) && !user) {
    const loginUrl = new URL("/login", request.url)
    const returnTo = `${pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set("next", returnTo)
    loginUrl.searchParams.set("redirectTo", returnTo)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isOperationalPanelPath(pathname)) {
    const staffInvite =
      user.user_metadata?.staff_invite === true ||
      user.user_metadata?.staff_invite === "true"
    const access = await resolveBusinessPanelAccess(supabase, user.id, user.email, {
      staffInvite,
    })
    if (!access.hasActiveAccess) {
      return redirectToBillingRecovery(
        request,
        billingRecoveryRedirectPath(access, { staffInvite }),
      )
    }
    if (access.effectiveRole === "staff" && isStaffForbiddenPanelPath(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  if (user && pathname.startsWith("/settings")) {
    const searchParams = request.nextUrl.searchParams
    const settingsExempt =
      isSettingsSetupPath(pathname, searchParams) ||
      isSettingsStripeReturnPath(searchParams) ||
      isSettingsBillingRecoveryPath(searchParams)
    if (!settingsExempt) {
      const staffInvite =
        user.user_metadata?.staff_invite === true ||
        user.user_metadata?.staff_invite === "true"
      const access = await resolveBusinessPanelAccess(supabase, user.id, user.email, {
        staffInvite,
      })
      if (!access.hasActiveAccess && !access.canManageBilling) {
        return redirectToBillingRecovery(request, "/subscription-required")
      }
      if (!access.hasActiveAccess && access.canManageBilling) {
        return redirectToBillingRecovery(request, "/activate-access")
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
