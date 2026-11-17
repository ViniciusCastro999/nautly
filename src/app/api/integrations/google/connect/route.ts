import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import {
  appUrl,
  authorizationUrl,
  GOOGLE_STATE_COOKIE as STATE_COOKIE,
  googleConfig,
} from "@/lib/google/calendar"
import { requireWorkspace } from "@/lib/session"

/** Inicia a conexão: guarda um `state` aleatório em cookie e manda para o Google. */
export async function GET() {
  await requireWorkspace()
  if (!googleConfig()) {
    return NextResponse.redirect(`${appUrl()}/app/settings/integrations?google=not_configured`)
  }
  const state = randomBytes(24).toString("base64url")
  const res = NextResponse.redirect(authorizationUrl(state))
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google",
    maxAge: 600,
  })
  return res
}
