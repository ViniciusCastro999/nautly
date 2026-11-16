import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { PageHeader } from "@/components/app/page-header"
import { ModulesSettings } from "@/components/app/settings/modules-settings"
import { ProceduresSettings } from "@/components/app/settings/procedures-settings"
import { ProfileSettings } from "@/components/app/settings/profile-settings"
import { TeamSettings } from "@/components/app/settings/team-settings"
import { db, schema } from "@/db"
import { modulesForVertical } from "@/lib/modules"
import { ROLE_LABELS } from "@/lib/permissions"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Configurações" }

export default async function SettingsPage() {
  const { org, user, vertical, can, hasModule } = await requireWorkspace()
  if (!can("settings:manage")) redirect("/app")

  const members = await db.query.membership.findMany({
    where: eq(schema.membership.organizationId, org.id),
    with: { user: true },
  })

  const procedures = hasModule("treatment_plan")
    ? await db.query.procedure.findMany({
        where: eq(schema.procedure.organizationId, org.id),
        orderBy: [asc(schema.procedure.name)],
      })
    : null

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Adapte o Nautly para a sua área e escolha os recursos que usa."
      />
      <div className="grid gap-6">
        <ProfileSettings
          vertical={vertical.id}
          organizationName={org.name}
          isClinic={org.kind === "clinic"}
          professionalRegistry={user.professionalRegistry ?? ""}
          taxId={user.taxId ?? ""}
          address={user.address ?? ""}
        />
        <ModulesSettings
          verticalLabel={vertical.label}
          enabled={org.modules as string[]}
          modules={modulesForVertical(vertical.id, vertical.group).map((m) => ({
            id: m.id,
            label: m.label,
            description: m.description,
            clinical: m.clinical,
            comingSoon: Boolean(m.comingSoon),
          }))}
        />
        {procedures && (
          <ProceduresSettings
            dental={hasModule("odontogram")}
            procedures={procedures.map((p) => ({
              id: p.id,
              name: p.name,
              priceCents: p.priceCents,
              effect: p.effect,
              perTooth: p.perTooth,
              isActive: p.isActive,
            }))}
          />
        )}
        <TeamSettings
          isClinic={org.kind === "clinic"}
          members={members.map((m) => ({
            id: m.id,
            name: m.user.name,
            email: m.user.email,
            role: ROLE_LABELS[m.role],
          }))}
        />
      </div>
    </>
  )
}
