import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { ChevronRightIcon, LayoutGridIcon, ListChecksIcon, UserRoundIcon, UsersIcon } from "lucide-react"
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

  const sections = [
    { id: "perfil", label: "Perfil profissional", icon: UserRoundIcon },
    { id: "recursos", label: "Recursos", icon: LayoutGridIcon },
    ...(procedures ? [{ id: "procedimentos", label: "Procedimentos", icon: ListChecksIcon }] : []),
    { id: "equipe", label: org.kind === "clinic" ? "Equipe" : "Acesso", icon: UsersIcon },
  ]

  return (
    <>
      <PageHeader title="Configurações" description="Ajuste o Nautly para a sua forma de atender." />
      <div className="grid items-start gap-[17px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Seções das configurações"
          className="grid gap-0.5 rounded-[13px] border bg-card p-2 lg:sticky lg:top-24"
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-sea-50 hover:text-primary dark:hover:text-foreground"
            >
              <Icon className="size-4" strokeWidth={1.8} />
              <span className="flex-1">{label}</span>
              <ChevronRightIcon className="size-3.5" />
            </a>
          ))}
        </nav>
        <div className="grid gap-[17px] [&>section]:scroll-mt-24">
          <section id="perfil">
            <ProfileSettings
              vertical={vertical.id}
              organizationName={org.name}
              isClinic={org.kind === "clinic"}
              professionalRegistry={user.professionalRegistry ?? ""}
              taxId={user.taxId ?? ""}
              address={user.address ?? ""}
            />
          </section>
          <section id="recursos">
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
          </section>
          {procedures && (
            <section id="procedimentos">
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
            </section>
          )}
          <section id="equipe">
            <TeamSettings
              isClinic={org.kind === "clinic"}
              members={members.map((m) => ({
                id: m.id,
                name: m.user.name,
                email: m.user.email,
                role: ROLE_LABELS[m.role],
              }))}
            />
          </section>
        </div>
      </div>
    </>
  )
}
