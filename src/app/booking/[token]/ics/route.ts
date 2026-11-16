import { NextResponse } from "next/server"
import { LOCATION_LABELS } from "@/lib/constants"
import { findBookingByToken } from "@/lib/scheduling/booking-lookup"

const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "")
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n")

export async function GET(_req: Request, { params }: RouteContext<"/booking/[token]/ics">) {
  const { token } = await params
  const b = await findBookingByToken(token)
  if (!b || b.status === "cancelled") return new NextResponse("Not found", { status: 404 })

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nautly Agendamentos//PT-BR",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@nautly.app`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(b.startsAt)}`,
    `DTEND:${fmt(b.endsAt)}`,
    `SUMMARY:${esc(`${b.eventType.title} com ${b.host.name}`)}`,
    `DESCRIPTION:${esc(b.eventType.description ?? "")}`,
    `LOCATION:${esc(b.eventType.locationDetail ?? LOCATION_LABELS[b.eventType.locationType])}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agendamento.ics"`,
    },
  })
}
