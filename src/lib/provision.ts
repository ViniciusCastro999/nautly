import { db, schema } from "@/db"

/** Minutos desde 00:00. */
const h = (hours: number) => hours * 60

export async function provisionWorkspace(user: {
  id: string
  name: string
  username: string
  timezone: string
}) {
  await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organization)
      .values({ name: user.name, slug: user.username, kind: "personal", vertical: null })
      .returning()

    await tx.insert(schema.membership).values({ organizationId: org.id, userId: user.id, role: "owner" })

    const [sched] = await tx
      .insert(schema.schedule)
      .values({ userId: user.id, name: "Horário comercial", timezone: user.timezone, isDefault: true })
      .returning()

    // Segunda a sexta, 09:00 às 12:00 e 13:00 às 18:00
    await tx.insert(schema.availabilityRule).values(
      [1, 2, 3, 4, 5].flatMap((weekday) => [
        { scheduleId: sched.id, weekday, startMinute: h(9), endMinute: h(12) },
        { scheduleId: sched.id, weekday, startMinute: h(13), endMinute: h(18) },
      ]),
    )

    // Tipos de evento são criados no onboarding, conforme a área escolhida.
  })
}
