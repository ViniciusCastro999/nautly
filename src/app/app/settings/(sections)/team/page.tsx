import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { PageHeader } from "@/components/app/page-header"
import { TeamSettings } from "@/components/app/settings/team-settings"
import { db, schema } from "@/db"
import { ROLE_LABELS } from "@/lib/permissions"
import { requireWorkspace } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const { org } = await requireWorkspace()
  return { title: org.kind === "clinic" ? "Equipe" : "Acesso" }
}

export default async function TeamSettingsPage() {
  const { org, can } = await requireWorkspace()
  if (!can("settings:manage")) redirect("/app/settings")
  const isClinic = org.kind === "clinic"

  const members = await db.query.membership.findMany({
    where: eq(schema.membership.organizationId, org.id),
    with: { user: true },
  })

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title={isClinic ? "Equipe" : "Acesso"}
        description={
          isClinic ? "Quem faz parte da clínica e o papel de cada um." : "Quem pode acessar a sua conta."
        }
      />
      <TeamSettings
        isClinic={isClinic}
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          role: ROLE_LABELS[m.role],
        }))}
      />
    </>
  )
}
