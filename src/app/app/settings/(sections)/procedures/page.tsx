import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { PageHeader } from "@/components/app/page-header"
import { ProceduresSettings } from "@/components/app/settings/procedures-settings"
import { db, schema } from "@/db"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Procedimentos" }

export default async function ProceduresSettingsPage() {
  const { org, can, hasModule } = await requireWorkspace()
  if (!can("settings:manage") || !hasModule("treatment_plan")) redirect("/app/settings")

  const procedures = await db.query.procedure.findMany({
    where: eq(schema.procedure.organizationId, org.id),
    orderBy: [asc(schema.procedure.name)],
  })

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Procedimentos"
        description="Catálogo e preços usados nos orçamentos e planos de tratamento."
      />
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
    </>
  )
}
