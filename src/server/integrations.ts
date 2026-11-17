"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { db, schema } from "@/db"
import { backfillUpcoming, disconnect } from "@/lib/google/calendar"
import { requireWorkspace } from "@/lib/session"

const PATH = "/app/settings/integrations"

const prefsSchema = z.object({ pushBookings: z.boolean(), blockBusy: z.boolean() })

export async function updateGoogleCalendarPrefs(input: z.input<typeof prefsSchema>) {
  const { user } = await requireWorkspace()
  const data = prefsSchema.parse(input)
  const [row] = await db
    .update(schema.calendarConnection)
    .set(data)
    .where(eq(schema.calendarConnection.userId, user.id))
    .returning({ id: schema.calendarConnection.id })
  if (!row) return { ok: false as const, error: "Conecte o Google Calendar primeiro." }
  // Ao religar o envio, leva para o Google o que ficou de fora.
  if (data.pushBookings) after(() => backfillUpcoming(user.id))
  revalidatePath(PATH)
  return { ok: true as const }
}

export async function disconnectGoogleCalendar() {
  const { user } = await requireWorkspace()
  await disconnect(user.id)
  revalidatePath(PATH)
  return { ok: true as const }
}
