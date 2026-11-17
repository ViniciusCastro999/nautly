import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { PageHeader } from "@/components/app/page-header"
import { EventTypeForm } from "@/components/app/event-type-form"
import { db, schema } from "@/db"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Editar serviço" }

export default async function EditEventTypePage({ params }: PageProps<"/app/event-types/[id]">) {
  const { id } = await params
  const { user, org } = await requireWorkspace()
  const eventType = await db.query.eventType.findFirst({
    where: and(eq(schema.eventType.id, id), eq(schema.eventType.organizationId, org.id)),
  })
  if (!eventType) notFound()

  return (
    <>
      <PageHeader title="Editar serviço" description={eventType.title} />
      <EventTypeForm eventType={eventType} username={user.username ?? ""} />
    </>
  )
}
