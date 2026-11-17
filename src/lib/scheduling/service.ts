import "server-only"
import { and, eq, gt, lt, sql } from "drizzle-orm"
import { db, schema, type Tx } from "@/db"
import { templateForVertical } from "@/lib/anamnesis"
import { googleBusy } from "@/lib/google/calendar"
import { getVertical } from "@/lib/verticals"
import { computeSlots, isSlotAvailable, type SlotInput } from "./slots"

type EventType = typeof schema.eventType.$inferSelect

const DAY = 24 * 60 * 60 * 1000

export async function findPublicEventType(username: string, slug: string) {
  const host = await db.query.user.findFirst({ where: eq(schema.user.username, username.toLowerCase()) })
  if (!host) return null
  const eventType = await db.query.eventType.findFirst({
    where: and(
      eq(schema.eventType.hostId, host.id),
      eq(schema.eventType.slug, slug),
      eq(schema.eventType.isActive, true),
    ),
  })
  if (!eventType) return null
  return { host, eventType }
}

/** Monta a entrada do motor de horários a partir do banco. */
async function loadSlotContext(
  q: Tx | typeof db,
  eventType: EventType,
  range: { from: Date; to: Date },
  /** Ocupado fora do Nautly (Google), buscado antes de abrir transação. */
  external: SlotInput["busy"] = [],
): Promise<Omit<SlotInput, "from" | "to" | "now">> {
  const sched = eventType.scheduleId
    ? await q.query.schedule.findFirst({
        where: eq(schema.schedule.id, eventType.scheduleId),
        with: { rules: true, overrides: true },
      })
    : await q.query.schedule.findFirst({
        where: and(eq(schema.schedule.userId, eventType.hostId), eq(schema.schedule.isDefault, true)),
        with: { rules: true, overrides: true },
      })

  // Agendamentos de QUALQUER tipo de evento do profissional bloqueiam a agenda.
  const { start: windowStart, end: windowEnd } = busyWindow(range)
  const bookingsBusy = await q
    .select({ start: schema.booking.startsAt, end: schema.booking.endsAt })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.hostId, eventType.hostId),
        eq(schema.booking.status, "confirmed"),
        lt(schema.booking.startsAt, windowEnd),
        gt(schema.booking.endsAt, windowStart),
      ),
    )
  const busy = [...bookingsBusy, ...external]

  return {
    timezone: sched?.timezone ?? "UTC",
    rules: sched?.rules ?? [],
    overrides: sched?.overrides ?? [],
    busy,
    durationMinutes: eventType.durationMinutes,
    bufferBeforeMinutes: eventType.bufferBeforeMinutes,
    bufferAfterMinutes: eventType.bufferAfterMinutes,
    minNoticeMinutes: eventType.minNoticeMinutes,
    maxDaysAhead: eventType.maxDaysAhead,
  }
}

function busyWindow(range: { from: Date; to: Date }) {
  return { start: new Date(range.from.getTime() - DAY), end: new Date(range.to.getTime() + DAY) }
}

/** Compromissos da agenda do Google do profissional, se conectada. */
function externalBusy(eventType: EventType, range: { from: Date; to: Date }) {
  const w = busyWindow(range)
  return googleBusy(eventType.hostId, w.start, w.end)
}

export async function getAvailableSlots(eventType: EventType, from: Date, to: Date) {
  const ctx = await loadSlotContext(db, eventType, { from, to }, await externalBusy(eventType, { from, to }))
  return computeSlots({ ...ctx, from, to, now: new Date() })
}

export class SlotUnavailableError extends Error {}

/**
 * Cria um agendamento de forma segura contra concorrência: um advisory lock
 * transacional por profissional serializa reservas simultâneas, e a
 * disponibilidade é recalculada dentro da transação antes de inserir.
 */
export async function createBooking(input: {
  eventType: EventType
  startsAt: Date
  name: string
  email: string
  phone?: string
  notes?: string
  inviteeTimezone: string
}) {
  const { eventType, startsAt } = input
  const endsAt = new Date(startsAt.getTime() + eventType.durationMinutes * 60_000)

  const external = await externalBusy(eventType, { from: startsAt, to: endsAt })

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${eventType.hostId}))`)

    const ctx = await loadSlotContext(tx, eventType, { from: startsAt, to: endsAt }, external)
    if (!isSlotAvailable({ ...ctx, now: new Date() }, startsAt)) {
      throw new SlotUnavailableError("Esse horário acabou de ser reservado. Escolha outro.")
    }

    const [contact] = await tx
      .insert(schema.contact)
      .values({
        organizationId: eventType.organizationId,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone || null,
      })
      .onConflictDoUpdate({
        target: [schema.contact.organizationId, schema.contact.email],
        set: { name: input.name, ...(input.phone ? { phone: input.phone } : {}) },
      })
      .returning()

    const [booking] = await tx
      .insert(schema.booking)
      .values({
        organizationId: eventType.organizationId,
        eventTypeId: eventType.id,
        hostId: eventType.hostId,
        contactId: contact.id,
        startsAt,
        endsAt,
        inviteeTimezone: input.inviteeTimezone,
        notes: input.notes || null,
      })
      .returning()

    await ensurePendingAnamnesis(tx, eventType.organizationId, contact.id)
    return booking
  })
}

/**
 * Com o módulo de anamnese ativo, um paciente novo recebe uma anamnese pendente
 * no primeiro agendamento; o link aparece na página de confirmação.
 */
async function ensurePendingAnamnesis(tx: Tx, organizationId: string, contactId: string) {
  const org = await tx.query.organization.findFirst({ where: eq(schema.organization.id, organizationId) })
  if (!org?.vertical || !(org.modules as string[]).includes("anamnesis")) return
  const existing = await tx.query.anamnesis.findFirst({
    where: eq(schema.anamnesis.contactId, contactId),
    columns: { id: true },
  })
  if (existing) return
  await tx.insert(schema.anamnesis).values({
    organizationId,
    contactId,
    templateId: templateForVertical(getVertical(org.vertical).id).id,
  })
}
