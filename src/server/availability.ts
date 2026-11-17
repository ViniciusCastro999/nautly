"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { requireWorkspace } from "@/lib/session"

const minute = z
  .number()
  .int()
  .min(0)
  .max(24 * 60)

const availabilitySchema = z.object({
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz })
      return true
    } catch {
      return false
    }
  }, "Fuso horário inválido"),
  rules: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: minute, endMinute: minute }))
    .refine((rules) => rules.every((r) => r.endMinute > r.startMinute), "O fim deve ser depois do início.")
    .refine((rules) => {
      for (let day = 0; day < 7; day++) {
        const list = rules.filter((r) => r.weekday === day).sort((a, b) => a.startMinute - b.startMinute)
        for (let i = 1; i < list.length; i++) if (list[i].startMinute < list[i - 1].endMinute) return false
      }
      return true
    }, "Há intervalos sobrepostos no mesmo dia."),
  blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(200),
})

export type AvailabilityInput = z.infer<typeof availabilitySchema>

export async function saveAvailability(input: AvailabilityInput) {
  const { user } = await requireWorkspace()
  const parsed = availabilitySchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  const { timezone, rules, blockedDates } = parsed.data

  const sched = await db.query.schedule.findFirst({
    where: and(eq(schema.schedule.userId, user.id), eq(schema.schedule.isDefault, true)),
  })
  if (!sched) return { ok: false as const, error: "Agenda não encontrada" }

  await db.transaction(async (tx) => {
    await tx.update(schema.schedule).set({ timezone }).where(eq(schema.schedule.id, sched.id))
    await tx.update(schema.user).set({ timezone }).where(eq(schema.user.id, user.id))

    await tx.delete(schema.availabilityRule).where(eq(schema.availabilityRule.scheduleId, sched.id))
    if (rules.length) {
      await tx.insert(schema.availabilityRule).values(rules.map((r) => ({ ...r, scheduleId: sched.id })))
    }

    await tx.delete(schema.dateOverride).where(eq(schema.dateOverride.scheduleId, sched.id))
    const uniqueDates = [...new Set(blockedDates)]
    if (uniqueDates.length) {
      await tx
        .insert(schema.dateOverride)
        .values(
          uniqueDates.map((date) => ({ scheduleId: sched.id, date, startMinute: null, endMinute: null })),
        )
    }
  })

  revalidatePath("/app/settings/availability")
  return { ok: true as const }
}
