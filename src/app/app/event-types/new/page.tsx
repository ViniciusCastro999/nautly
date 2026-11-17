import type { Metadata } from "next"
import { PageHeader } from "@/components/app/page-header"
import { EventTypeForm } from "@/components/app/event-type-form"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Novo serviço" }

export default async function NewEventTypePage() {
  const { user } = await requireWorkspace()
  return (
    <>
      <PageHeader title="Novo serviço" description="Defina como as pessoas vão agendar com você." />
      <EventTypeForm username={user.username ?? ""} />
    </>
  )
}
