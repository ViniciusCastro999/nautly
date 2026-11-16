import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

/**
 * Checagem otimista: sem cookie de sessão, nem renderiza o painel.
 * A validação real acontece no servidor (requireWorkspace).
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request))
  const { pathname } = request.nextUrl

  if ((pathname.startsWith("/app") || pathname === "/onboarding") && !hasSession) {
    const url = new URL("/login", request.url)
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/onboarding"],
}
