import type { Metadata } from "next"
import { and, count, eq, gt, isNotNull } from "drizzle-orm"
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { GoogleCalendarCard } from "@/components/app/settings/google-calendar-card"
import { db, schema } from "@/db"
import { getConnection, googleConfig } from "@/lib/google/calendar"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Integrações" }

const RESULTS: Record<string, { ok: boolean; text: string }> = {
  connected: {
    ok: true,
    text: "Google Calendar conectado. Seus próximos agendamentos já estão sendo enviados.",
  },
  denied: { ok: false, text: "A conexão foi cancelada no Google." },
  missing_scopes: {
    ok: false,
    text: "Faltou autorizar o acesso à agenda. Conecte de novo e marque todas as permissões pedidas.",
  },
  invalid_state: { ok: false, text: "A conexão expirou. Tente de novo." },
  not_configured: { ok: false, text: "A integração com o Google ainda não foi ativada neste servidor." },
  error: { ok: false, text: "Não foi possível conectar ao Google. Tente de novo em instantes." },
}

export default async function IntegrationsPage({ searchParams }: PageProps<"/app/settings/integrations">) {
  const { user } = await requireWorkspace()
  const params = await searchParams
  const result = typeof params.google === "string" ? RESULTS[params.google] : undefined

  const conn = await getConnection(user.id)
  const synced = conn
    ? (
        await db
          .select({ n: count() })
          .from(schema.booking)
          .where(
            and(
              eq(schema.booking.hostId, user.id),
              isNotNull(schema.booking.googleEventId),
              gt(schema.booking.startsAt, new Date()),
            ),
          )
      )[0].n
    : 0

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Integrações"
        description="Conecte o Nautly às ferramentas que você já usa."
      />
      {result && (
        <p
          className={
            result.ok
              ? "mb-[17px] flex items-start gap-2 rounded-[13px] bg-ok-50 px-4 py-3 text-[13px] font-semibold text-ok"
              : "mb-[17px] flex items-start gap-2 rounded-[13px] bg-warm-50 px-4 py-3 text-[13px] font-semibold text-warm-foreground"
          }
        >
          {result.ok ? (
            <CheckCircle2Icon className="mt-px size-4 shrink-0" />
          ) : (
            <AlertTriangleIcon className="mt-px size-4 shrink-0" />
          )}
          {result.text}
        </p>
      )}
      <GoogleCalendarCard
        configured={Boolean(googleConfig())}
        connection={
          conn
            ? {
                accountEmail: conn.accountEmail,
                pushBookings: conn.pushBookings,
                blockBusy: conn.blockBusy,
                lastError: conn.lastError,
                syncedUpcoming: synced,
              }
            : null
        }
      />
    </>
  )
}
