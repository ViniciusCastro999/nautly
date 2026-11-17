import { NextResponse, after, type NextRequest } from "next/server"
import {
  appUrl,
  backfillUpcoming,
  connectWithCode,
  GOOGLE_STATE_COOKIE as STATE_COOKIE,
  GoogleError,
} from "@/lib/google/calendar"
import { requireWorkspace } from "@/lib/session"

/** Volta do Google: confere o `state`, troca o código por tokens e envia a agenda futura. */
export async function GET(request: NextRequest) {
  const { user } = await requireWorkspace()
  const params = request.nextUrl.searchParams
  const back = (result: string) => {
    const res = NextResponse.redirect(`${appUrl()}/app/settings/integrations?google=${result}`)
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations/google" })
    return res
  }

  const expected = request.cookies.get(STATE_COOKIE)?.value
  if (!expected || params.get("state") !== expected) return back("invalid_state")
  if (params.get("error")) return back("denied")
  const code = params.get("code")
  if (!code) return back("denied")

  try {
    await connectWithCode(user.id, code)
  } catch (err) {
    console.error("Conexão com o Google falhou", err)
    const reason = err instanceof GoogleError && err.message === "missing_scopes" ? "missing_scopes" : "error"
    return back(reason)
  }

  after(() => backfillUpcoming(user.id))
  return back("connected")
}
