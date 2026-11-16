import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  CalendarIcon,
  CalendarPlusIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClipboardListIcon,
  DownloadIcon,
  GlobeIcon,
  MapPinIcon,
  UserIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicShell } from "@/components/booking/public-shell"
import { CancelBookingButton } from "@/components/booking/cancel-booking-button"
import { LOCATION_LABELS } from "@/lib/constants"
import { formatInTz, tzLabel } from "@/lib/format"
import { findBookingByToken, findPendingAnamnesis } from "@/lib/scheduling/booking-lookup"

export const metadata: Metadata = { title: "Seu agendamento", robots: { index: false } }

function googleCalendarUrl(b: NonNullable<Awaited<ReturnType<typeof findBookingByToken>>>) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "")
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.eventType.title} com ${b.host.name}`,
    dates: `${fmt(b.startsAt)}/${fmt(b.endsAt)}`,
    details: b.eventType.description ?? "",
    location: b.eventType.locationDetail ?? LOCATION_LABELS[b.eventType.locationType],
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export default async function BookingPage({ params }: PageProps<"/booking/[token]">) {
  const { token } = await params
  const b = await findBookingByToken(token)
  if (!b) notFound()

  const tz = b.inviteeTimezone
  const cancelled = b.status === "cancelled"
  const upcoming = b.startsAt > new Date()
  const anamnesis = !cancelled && upcoming ? await findPendingAnamnesis(b.contactId) : null

  return (
    <PublicShell>
      <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 text-center shadow-[0_1px_8px_rgba(0,0,0,0.08)] sm:p-10 dark:shadow-none">
        {cancelled ? (
          <CircleXIcon className="mx-auto mb-3 size-10 text-destructive" />
        ) : (
          <CircleCheckIcon className="mx-auto mb-3 size-10 text-success" />
        )}
        <h1 className="text-2xl font-bold">
          {cancelled ? "Agendamento cancelado" : "Agendamento confirmado"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {cancelled
            ? "Este horário foi liberado."
            : "Guarde este link: por ele você pode adicionar à sua agenda ou cancelar."}
        </p>

        {anamnesis && (
          <Link
            href={`/anamnese/${anamnesis.token}`}
            className="mx-auto mt-6 flex max-w-md items-center gap-3 rounded-xl border border-primary/30 bg-accent p-4 text-left transition-colors hover:border-primary"
          >
            <ClipboardListIcon className="size-6 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-accent-foreground">Preencha sua anamnese</span>
              <span className="block text-sm text-muted-foreground">
                Leva uns 3 minutos e deixa o primeiro atendimento mais produtivo.
              </span>
            </span>
          </Link>
        )}

        <div className="mx-auto mt-8 max-w-md rounded-xl border p-6 text-left">
          <h2 className="mb-4 text-lg font-bold">{b.eventType.title}</h2>
          <ul className="grid gap-3 text-sm font-medium text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <UserIcon className="size-4 shrink-0" /> {b.host.name}
            </li>
            <li className="flex items-start gap-2.5">
              <CalendarIcon className="mt-0.5 size-4 shrink-0" />
              <span className={`${cancelled ? "line-through" : ""}`}>
                {formatInTz(b.startsAt, tz, "HH:mm")} às {formatInTz(b.endsAt, tz, "HH:mm")},{" "}
                {formatInTz(b.startsAt, tz, "EEEE, d 'de' MMMM 'de' yyyy")}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <GlobeIcon className="size-4 shrink-0" /> {tzLabel(tz)}
            </li>
            <li className="flex items-start gap-2.5">
              <MapPinIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                {LOCATION_LABELS[b.eventType.locationType]}
                {b.eventType.locationDetail && (
                  <span className="block font-normal">{b.eventType.locationDetail}</span>
                )}
              </span>
            </li>
          </ul>
          {cancelled && b.cancelReason && (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">Motivo: {b.cancelReason}</p>
          )}
        </div>

        {!cancelled && upcoming && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <a href={googleCalendarUrl(b)} target="_blank" rel="noreferrer">
                <CalendarPlusIcon /> Google Agenda
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <a href={`/booking/${token}/ics`}>
                <DownloadIcon /> Arquivo .ics
              </a>
            </Button>
            <CancelBookingButton token={token} />
          </div>
        )}

        <p className="mt-10 text-sm text-muted-foreground">
          Quer seu próprio link de agendamento?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Crie grátis no Nautly
          </Link>
        </p>
      </div>
    </PublicShell>
  )
}
