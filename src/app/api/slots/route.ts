import { NextResponse, type NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "@/db"
import { getAvailableSlots } from "@/lib/scheduling/service"

const query = z.object({
  eventTypeId: z.string().min(1),
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
})

const MAX_RANGE = 45 * 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })

  const from = new Date(parsed.data.from)
  const to = new Date(parsed.data.to)
  if (to <= from || to.getTime() - from.getTime() > MAX_RANGE) {
    return NextResponse.json({ error: "Intervalo inválido" }, { status: 400 })
  }

  const eventType = await db.query.eventType.findFirst({
    where: and(eq(schema.eventType.id, parsed.data.eventTypeId), eq(schema.eventType.isActive, true)),
  })
  if (!eventType) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 })

  const slots = await getAvailableSlots(eventType, from, to)
  return NextResponse.json({ slots: slots.map((s) => s.toISOString()) })
}
