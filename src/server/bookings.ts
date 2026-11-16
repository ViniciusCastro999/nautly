"use server"

import { and, eq, gt, gte, lt, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { formatInTz } from "@/lib/format"
import { buildOccurrences, MAX_OCCURRENCES, splitConflicts } from "@/lib/scheduling/recurrence"
import { requirePermission } from "@/lib/session"

function revalidateAgenda(contactId?: string) {
  revalidatePath("/app/bookings")
  if (contactId) revalidatePath(`/app/contacts/${contactId}`)
}

export async function cancelBookingAsHost(id: string, reason: string) {
  const { org } = await requirePermission("agenda:manage")
  await db
    .update(schema.booking)
    .set({ status: "cancelled", cancelReason: reason.trim().slice(0, 500) || null })
    .where(and(eq(schema.booking.id, id), eq(schema.booking.organizationId, org.id)))
  revalidateAgenda()
}

/** Cancela esta ocorrência e todas as seguintes da mesma série. */
export async function cancelSeriesFrom(id: string, reason: string) {
  const { org } = await requirePermission("agenda:manage")
  const current = await db.query.booking.findFirst({
    where: and(eq(schema.booking.id, id), eq(schema.booking.organizationId, org.id)),
  })
  if (!current?.seriesId) return { ok: false as const, error: "Agendamento não faz parte de uma série." }

  const cancelled = await db
    .update(schema.booking)
    .set({ status: "cancelled", cancelReason: reason.trim().slice(0, 500) || null })
    .where(
      and(
        eq(schema.booking.seriesId, current.seriesId),
        eq(schema.booking.organizationId, org.id),
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.startsAt, current.startsAt),
      ),
    )
    .returning({ id: schema.booking.id })
  revalidateAgenda(current.contactId)
  return { ok: true as const, count: cancelled.length }
}

export async function setAttendance(id: string, value: "attended" | "no_show" | null) {
  const { org } = await requirePermission("agenda:manage")
  const [row] = await db
    .update(schema.booking)
    .set({ attendance: value })
    .where(
      and(
        eq(schema.booking.id, id),
        eq(schema.booking.organizationId, org.id),
        eq(schema.booking.status, "confirmed"),
        lt(schema.booking.startsAt, new Date()),
      ),
    )
    .returning({ contactId: schema.booking.contactId })
  if (!row) return { ok: false as const, error: "Só é possível marcar presença de agendamentos passados." }
  revalidateAgenda(row.contactId)
  return { ok: true as const }
}

const manualSchema = z.object({
  contactId: z.string().min(1),
  eventTypeId: z.string().min(1),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  repeat: z.enum(["none", "weekly", "biweekly"]),
  count: z.coerce.number().int().min(2).max(MAX_OCCURRENCES).default(8),
  notes: z.string().trim().max(1000).optional(),
})

export type ManualBookingResult =
  { ok: true; created: number; skipped: string[] } | { ok: false; error: string }

/**
 * Agendamento feito pelo próprio profissional ou pela recepção. Pode ficar fora
 * da disponibilidade pública (encaixe), mas nunca sobrepõe outro agendamento.
 */
export async function createManualBooking(input: z.input<typeof manualSchema>): Promise<ManualBookingResult> {
  const ctx = await requirePermission("agenda:manage")
  const parsed = manualSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Revise data, horário e repetição." }
  const data = parsed.data
  if (data.repeat !== "none" && !ctx.hasModule("recurring")) {
    return { ok: false, error: "Ative o módulo de agendamentos recorrentes nas configurações." }
  }

  const [eventType, contact] = await Promise.all([
    db.query.eventType.findFirst({
      where: and(eq(schema.eventType.id, data.eventTypeId), eq(schema.eventType.organizationId, ctx.org.id)),
    }),
    db.query.contact.findFirst({
      where: and(eq(schema.contact.id, data.contactId), eq(schema.contact.organizationId, ctx.org.id)),
    }),
  ])
  if (!eventType || !contact) return { ok: false, error: "Tipo de evento ou cadastro não encontrado." }

  const timezone = ctx.user.timezone
  const occurrences = buildOccurrences({
    date: data.date,
    time: data.time,
    timezone,
    durationMinutes: eventType.durationMinutes,
    repeat: data.repeat,
    count: data.count,
  })

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${eventType.hostId}))`)
    const existing = await tx
      .select({ startsAt: schema.booking.startsAt, endsAt: schema.booking.endsAt })
      .from(schema.booking)
      .where(
        and(
          eq(schema.booking.hostId, eventType.hostId),
          eq(schema.booking.status, "confirmed"),
          lt(schema.booking.startsAt, occurrences.at(-1)!.endsAt),
          gt(schema.booking.endsAt, occurrences[0].startsAt),
        ),
      )
    const { free, conflicts } = splitConflicts(occurrences, existing)
    if (free.length === 0) return { created: 0, conflicts }

    let seriesId: string | null = null
    if (data.repeat !== "none") {
      const [series] = await tx
        .insert(schema.bookingSeries)
        .values({
          organizationId: ctx.org.id,
          hostId: eventType.hostId,
          contactId: contact.id,
          eventTypeId: eventType.id,
          frequency: data.repeat,
          timezone,
        })
        .returning({ id: schema.bookingSeries.id })
      seriesId = series.id
    }

    await tx.insert(schema.booking).values(
      free.map((o) => ({
        organizationId: ctx.org.id,
        eventTypeId: eventType.id,
        hostId: eventType.hostId,
        contactId: contact.id,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        inviteeTimezone: timezone,
        notes: data.notes || null,
        seriesId,
      })),
    )
    return { created: free.length, conflicts }
  })

  const skipped = result.conflicts.map((c) => formatInTz(c.startsAt, timezone, "dd/MM 'às' HH:mm"))
  if (result.created === 0) {
    return { ok: false, error: `Horário ocupado: ${skipped.join(", ")}.` }
  }
  revalidateAgenda(contact.id)
  return { ok: true, created: result.created, skipped }
}
