import type { Metadata } from "next"
import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/app/page-header"
import { AvailabilityEditor } from "@/components/app/availability-editor"
import { db, schema } from "@/db"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Disponibilidade" }

export default async function AvailabilitySettingsPage() {
  const { user } = await requireWorkspace()
  const sched = await db.query.schedule.findFirst({
    where: and(eq(schema.schedule.userId, user.id), eq(schema.schedule.isDefault, true)),
    with: { rules: true, overrides: true },
  })
  if (!sched) notFound()

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Disponibilidade"
        description="Escolha os dias e horários em que você aceita agendamentos. Vale para todos os seus serviços."
      />
      <AvailabilityEditor
        timezone={sched.timezone}
        rules={sched.rules.map(({ weekday, startMinute, endMinute }) => ({
          weekday,
          startMinute,
          endMinute,
        }))}
        blockedDates={sched.overrides.filter((o) => o.startMinute == null).map((o) => o.date)}
      />
    </>
  )
}
