import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"
import { isSupabaseConfigured } from "@/lib/supabase/server"

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  if (pathname === "/pricing") return true
  if (pathname === "/login") return true
  if (pathname === "/signup") return true
  if (pathname === "/signup-staff") return true
  if (pathname === "/terms") return true
  if (pathname === "/developer-contact") return true
  if (pathname.startsWith("/book/")) return true
  if (pathname.startsWith("/confirm/")) return true
  if (pathname.startsWith("/auth/")) return true
  if (pathname.startsWith("/accept-invite/")) return true
  return false
}

function isProtectedPath(pathname: string): boolean {
  const prefixes = [
    "/dashboard",
    "/appointments",
    "/schedule",
    "/services",
    "/team",
    "/availability",
    "/clients",
    "/messages",
    "/templates",
    "/settings",
    "/account",
    "/guide",
    "/help",
  ]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request })
  }

  const { response, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  if (isPublicPath(pathname)) {
    if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/signup-staff")) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return response
  }

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
