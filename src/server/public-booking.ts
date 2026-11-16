"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { createBooking, SlotUnavailableError } from "@/lib/scheduling/service"

const bookingSchema = z.object({
  eventTypeId: z.string().min(1),
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.email("Informe um e-mail válido.").max(200),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
  timezone: z.string().min(1).max(64),
})

export type BookSlotResult = { ok: true; token: string } | { ok: false; error: string; slotTaken?: boolean }

export async function bookSlot(input: z.input<typeof bookingSchema>): Promise<BookSlotResult> {
  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  const data = parsed.data

  const eventType = await db.query.eventType.findFirst({
    where: and(eq(schema.eventType.id, data.eventTypeId), eq(schema.eventType.isActive, true)),
  })
  if (!eventType) return { ok: false, error: "Este evento não está mais disponível." }

  try {
    const booking = await createBooking({
      eventType,
      startsAt: new Date(data.startsAt),
      name: data.name,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      inviteeTimezone: data.timezone,
    })
    revalidatePath("/app/bookings")
    return { ok: true, token: booking.manageToken }
  } catch (err) {
    if (err instanceof SlotUnavailableError) return { ok: false, error: err.message, slotTaken: true }
    throw err
  }
}

export async function cancelBookingByToken(token: string, reason: string) {
  const booking = await db.query.booking.findFirst({ where: eq(schema.booking.manageToken, token) })
  if (!booking || booking.status === "cancelled") return { ok: false as const }
  if (booking.startsAt < new Date()) return { ok: false as const }
  await db
    .update(schema.booking)
    .set({ status: "cancelled", cancelReason: reason.trim().slice(0, 500) || "Cancelado pelo convidado" })
    .where(eq(schema.booking.id, booking.id))
  revalidatePath(`/booking/${token}`)
  revalidatePath("/app/bookings")
  return { ok: true as const }
}
