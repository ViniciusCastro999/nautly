import "server-only"
import { and, eq, gt, inArray, isNull } from "drizzle-orm"
import { db, schema } from "@/db"
import { decryptText, encryptText } from "@/lib/crypto"
import { buildGoogleEvent, mergeBusy } from "./event"

/**
 * Integração com o Google Calendar via OAuth 2.0 e a API REST (sem SDK).
 * Escopos mínimos: criar/editar os eventos do Nautly e consultar horários
 * ocupados (free/busy). O Nautly não lê o conteúdo dos outros compromissos.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
]

export const GOOGLE_STATE_COOKIE = "nautly_google_state"

const API = "https://www.googleapis.com/calendar/v3"
const TIMEOUT_MS = 4000

type Connection = typeof schema.calendarConnection.$inferSelect

export function appUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, redirectUri: `${appUrl()}/api/integrations/google/callback` }
}

export function authorizationUrl(state: string) {
  const cfg = googleConfig()
  if (!cfg) throw new Error("Google não configurado")
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    // Sempre pede consentimento para garantir o refresh token.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  id_token?: string
  scope?: string
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(TIMEOUT_MS * 2),
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string }
  if (!res.ok) throw new GoogleError(data.error ?? `HTTP ${res.status}`, res.status)
  return data
}

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

/** Troca o código do callback por tokens e grava a conexão do usuário. */
export async function connectWithCode(userId: string, code: string) {
  const cfg = googleConfig()
  if (!cfg) throw new Error("Google não configurado")
  const tokens = await tokenRequest({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  })
  const granted = new Set((tokens.scope ?? "").split(" "))
  const missing = GOOGLE_SCOPES.filter((s) => s.startsWith("https://") && !granted.has(s))
  if (missing.length) throw new GoogleError("missing_scopes")
  if (!tokens.refresh_token) throw new GoogleError("no_refresh_token")

  // O id_token veio direto do Google por HTTPS: basta ler o e-mail.
  const claims = tokens.id_token
    ? (JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()) as { email?: string })
    : {}

  const values = {
    accountEmail: claims.email ?? "Conta Google",
    accessTokenEncrypted: encryptText(tokens.access_token),
    refreshTokenEncrypted: encryptText(tokens.refresh_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    lastError: null,
  }
  await db
    .insert(schema.calendarConnection)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.calendarConnection.userId, set: values })
}

async function accessToken(conn: Connection) {
  if (conn.accessTokenExpiresAt.getTime() - Date.now() > 60_000) {
    return decryptText(conn.accessTokenEncrypted)
  }
  const cfg = googleConfig()
  if (!cfg) throw new GoogleError("not_configured")
  try {
    const tokens = await tokenRequest({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: decryptText(conn.refreshTokenEncrypted),
      grant_type: "refresh_token",
    })
    await db
      .update(schema.calendarConnection)
      .set({
        accessTokenEncrypted: encryptText(tokens.access_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        ...(tokens.refresh_token ? { refreshTokenEncrypted: encryptText(tokens.refresh_token) } : {}),
      })
      .where(eq(schema.calendarConnection.id, conn.id))
    return tokens.access_token
  } catch (err) {
    if (err instanceof GoogleError && err.message === "invalid_grant") {
      await markError(conn.id, "O acesso ao Google foi revogado. Conecte de novo.")
    }
    throw err
  }
}

async function markError(connectionId: string, message: string | null) {
  await db
    .update(schema.calendarConnection)
    .set({ lastError: message })
    .where(eq(schema.calendarConnection.id, connectionId))
}

async function api(conn: Connection, path: string, init: RequestInit = {}) {
  const token = await accessToken(conn)
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

export function getConnection(userId: string) {
  return db.query.calendarConnection.findFirst({ where: eq(schema.calendarConnection.userId, userId) })
}

/**
 * Horários ocupados no Google do profissional. Se o Google falhar ou demorar,
 * devolve lista vazia: a página de agendamento nunca deve cair por isso.
 */
export async function googleBusy(userId: string, from: Date, to: Date) {
  const conn = await getConnection(userId)
  if (!conn?.blockBusy || conn.lastError?.includes("revogado") || !googleConfig()) return []
  try {
    const res = await api(conn, "/freeBusy", {
      method: "POST",
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: conn.calendarId }],
      }),
    })
    if (!res.ok) throw new GoogleError(`freeBusy HTTP ${res.status}`, res.status)
    const data = (await res.json()) as {
      calendars: Record<string, { busy?: { start: string; end: string }[] }>
    }
    const busy = data.calendars[conn.calendarId]?.busy ?? []
    return mergeBusy(busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) })))
  } catch (err) {
    console.error("Google free/busy falhou", err)
    return []
  }
}

/**
 * Leva os agendamentos para o Google: cria, atualiza ou remove o evento
 * conforme o status. Erros são registrados na conexão, sem quebrar o fluxo.
 */
export async function syncBookings(bookingIds: string[]) {
  if (bookingIds.length === 0 || !googleConfig()) return
  const rows = await db.query.booking.findMany({
    where: inArray(schema.booking.id, bookingIds),
    with: { eventType: true, contact: true },
  })
  const connections = new Map<string, Connection | undefined>()

  for (const b of rows) {
    if (!connections.has(b.hostId)) connections.set(b.hostId, await getConnection(b.hostId))
    const conn = connections.get(b.hostId)
    if (!conn?.pushBookings) continue
    const calendar = encodeURIComponent(conn.calendarId)

    try {
      if (b.status === "cancelled") {
        if (!b.googleEventId) continue
        const res = await api(conn, `/calendars/${calendar}/events/${b.googleEventId}?sendUpdates=none`, {
          method: "DELETE",
        })
        if (!res.ok && res.status !== 404 && res.status !== 410) {
          throw new GoogleError(`delete HTTP ${res.status}`, res.status)
        }
        await db.update(schema.booking).set({ googleEventId: null }).where(eq(schema.booking.id, b.id))
        continue
      }

      const body = JSON.stringify(
        buildGoogleEvent({
          id: b.id,
          startsAt: b.startsAt,
          endsAt: b.endsAt,
          service: b.eventType.title,
          locationType: b.eventType.locationType,
          locationDetail: b.eventType.locationDetail,
          contact: b.contact,
          recordUrl: `${appUrl()}/app/contacts/${b.contactId}`,
        }),
      )
      let res = b.googleEventId
        ? await api(conn, `/calendars/${calendar}/events/${b.googleEventId}`, { method: "PATCH", body })
        : null
      // Evento apagado direto no Google: cria de novo.
      if (!res || res.status === 404 || res.status === 410) {
        res = await api(conn, `/calendars/${calendar}/events`, { method: "POST", body })
      }
      if (!res.ok) throw new GoogleError(`event HTTP ${res.status}`, res.status)
      const ev = (await res.json()) as { id: string }
      if (ev.id !== b.googleEventId) {
        await db.update(schema.booking).set({ googleEventId: ev.id }).where(eq(schema.booking.id, b.id))
      }
      if (conn.lastError) await markError(conn.id, null)
    } catch (err) {
      console.error("Sincronização com o Google falhou", err)
      if (!(err instanceof GoogleError && err.message === "invalid_grant")) {
        await markError(
          conn.id,
          "Não foi possível enviar um agendamento ao Google. Tentaremos de novo no próximo.",
        )
      }
    }
  }
}

/** Envia ao Google os agendamentos futuros que ainda não estão lá (ao conectar). */
export async function backfillUpcoming(userId: string) {
  const rows = await db
    .select({ id: schema.booking.id })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.hostId, userId),
        eq(schema.booking.status, "confirmed"),
        gt(schema.booking.startsAt, new Date()),
        isNull(schema.booking.googleEventId),
      ),
    )
    .limit(200)
  await syncBookings(rows.map((r) => r.id))
}

/** Revoga o acesso no Google (melhor esforço) e apaga a conexão. */
export async function disconnect(userId: string) {
  const conn = await getConnection(userId)
  if (!conn) return
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: decryptText(conn.refreshTokenEncrypted) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    console.error("Falha ao revogar token do Google", err)
  }
  await db.delete(schema.calendarConnection).where(eq(schema.calendarConnection.id, conn.id))
  await db.update(schema.booking).set({ googleEventId: null }).where(eq(schema.booking.hostId, userId))
}
