/**
 * Monta o evento do Google Calendar para um agendamento. Função pura (sem
 * rede), para poder ser testada. Dados clínicos nunca vão para o Google:
 * só nome, contato, serviço e local.
 */

export type BookingForEvent = {
  id: string
  startsAt: Date
  endsAt: Date
  service: string
  locationType: "video" | "phone" | "in_person"
  locationDetail: string | null
  contact: { name: string; email: string | null; phone: string | null }
  /** Link para a ficha no Nautly. */
  recordUrl: string
}

const LOCATION_LABELS: Record<BookingForEvent["locationType"], string> = {
  video: "Videochamada",
  phone: "Telefone",
  in_person: "Presencial",
}

export function buildGoogleEvent(b: BookingForEvent) {
  const lines = [
    `${b.service} com ${b.contact.name}`,
    b.contact.phone && `Telefone: ${b.contact.phone}`,
    b.contact.email && `E-mail: ${b.contact.email}`,
    "",
    `Ficha no Nautly: ${b.recordUrl}`,
  ].filter((l): l is string => typeof l === "string")

  const location =
    b.locationType === "in_person"
      ? b.locationDetail || LOCATION_LABELS.in_person
      : [LOCATION_LABELS[b.locationType], b.locationDetail].filter(Boolean).join(": ")

  return {
    summary: `${b.service} · ${b.contact.name}`,
    description: lines.join("\n"),
    location,
    start: { dateTime: b.startsAt.toISOString() },
    end: { dateTime: b.endsAt.toISOString() },
    // Lembretes ficam com o padrão da agenda do profissional.
    reminders: { useDefault: true },
    extendedProperties: { private: { nautlyBookingId: b.id } },
    source: { title: "Nautly", url: b.recordUrl },
  }
}

/** Junta intervalos ocupados que se sobrepõem (o Google já devolve ordenado, mas não garante). */
export function mergeBusy(list: { start: Date; end: Date }[]) {
  const sorted = [...list].sort((a, b) => +a.start - +b.start)
  const out: { start: Date; end: Date }[] = []
  for (const cur of sorted) {
    const last = out.at(-1)
    if (last && cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end
    } else out.push({ start: cur.start, end: cur.end })
  }
  return out
}
