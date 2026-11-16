"use server"

import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db, schema } from "@/db"
import { parseBRL } from "@/lib/documents/money"
import { requireWorkspace } from "@/lib/session"

const eventTypeSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, "Dê um nome ao evento.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use letras minúsculas, números e hífens.")
    .min(2)
    .max(60),
  description: z.string().trim().max(1000).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  locationType: z.enum(["video", "phone", "in_person"]),
  locationDetail: z.string().trim().max(300).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
  minNoticeMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 30),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  priceCents: z.number({ error: "Valor inválido, ex.: 250,00" }).int().min(0).max(99_999_999).nullable(),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
})

export type EventTypeFormState = {
  errors?: Partial<Record<keyof z.infer<typeof eventTypeSchema>, string>>
  message?: string
}

export async function saveEventType(
  _prev: EventTypeFormState,
  formData: FormData,
): Promise<EventTypeFormState> {
  const { user, org } = await requireWorkspace()

  const raw = Object.fromEntries(formData)
  const price = String(raw.price ?? "").trim()
  const parsed = eventTypeSchema.safeParse({
    ...raw,
    isActive: raw.isActive ?? false,
    priceCents: price ? (parseBRL(price) ?? Number.NaN) : null,
  })
  if (!parsed.success) {
    const errors: EventTypeFormState["errors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof errors
      errors[key] ??= issue.message
    }
    return { errors, message: "Revise os campos destacados." }
  }
  const { id, ...data } = parsed.data

  const slugTaken = await db.query.eventType.findFirst({
    where: and(
      eq(schema.eventType.hostId, user.id),
      eq(schema.eventType.slug, data.slug),
      id ? ne(schema.eventType.id, id) : undefined,
    ),
  })
  if (slugTaken) return { errors: { slug: "Você já tem um evento com esse link." } }

  const values = {
    ...data,
    description: data.description || null,
    locationDetail: data.locationDetail || null,
  }

  if (id) {
    const updated = await db
      .update(schema.eventType)
      .set(values)
      .where(and(eq(schema.eventType.id, id), eq(schema.eventType.organizationId, org.id)))
      .returning({ id: schema.eventType.id })
    if (!updated.length) return { message: "Evento não encontrado." }
  } else {
    const defaultSchedule = await db.query.schedule.findFirst({
      where: and(eq(schema.schedule.userId, user.id), eq(schema.schedule.isDefault, true)),
    })
    await db.insert(schema.eventType).values({
      ...values,
      organizationId: org.id,
      hostId: user.id,
      scheduleId: defaultSchedule?.id,
    })
  }

  revalidatePath("/app/event-types")
  redirect("/app/event-types?saved=1")
}

export async function setEventTypeActive(id: string, isActive: boolean) {
  const { org } = await requireWorkspace()
  await db
    .update(schema.eventType)
    .set({ isActive })
    .where(and(eq(schema.eventType.id, id), eq(schema.eventType.organizationId, org.id)))
  revalidatePath("/app/event-types")
}

export async function deleteEventType(id: string) {
  const { org } = await requireWorkspace()
  await db
    .delete(schema.eventType)
    .where(and(eq(schema.eventType.id, id), eq(schema.eventType.organizationId, org.id)))
  revalidatePath("/app/event-types")
}
