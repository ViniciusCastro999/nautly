import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { asc, count, eq } from "drizzle-orm"
import { PageHeader } from "@/components/app/page-header"
import { ProceduresManager } from "@/components/app/procedures/procedures-manager"
import { db, schema } from "@/db"
import { formatBRL } from "@/lib/documents/money"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Procedimentos" }

export default async function ProceduresPage() {
  const { org, can, hasModule } = await requireWorkspace()
  if (!hasModule("treatment_plan") || !can("settings:manage")) redirect("/app")

  const { procedure, treatmentItem, treatmentPlan } = schema
  const [procedures, usage] = await Promise.all([
    db.query.procedure.findMany({
      where: eq(procedure.organizationId, org.id),
      orderBy: [asc(procedure.name)],
    }),
    db
      .select({ procedureId: treatmentItem.procedureId, n: count() })
      .from(treatmentItem)
      .innerJoin(treatmentPlan, eq(treatmentPlan.id, treatmentItem.planId))
      .where(eq(treatmentPlan.organizationId, org.id))
      .groupBy(treatmentItem.procedureId),
  ])
  const uses = new Map(usage.map((u) => [u.procedureId, u.n]))

  const active = procedures.filter((p) => p.isActive)
  const prices = active.map((p) => p.priceCents)
  const used = active.filter((p) => (uses.get(p.id) ?? 0) > 0).length

  return (
    <>
      <PageHeader
        eyebrow="Procedimentos"
        title="Procedimentos e preços"
        description="Catálogo usado para montar orçamentos e planos de tratamento."
      />

      <div className="mb-[17px] grid gap-[13px] sm:grid-cols-3">
        <Summary label="Ativos" value={String(active.length)} hint="Aparecem ao montar um orçamento" />
        <Summary label="Já usados" value={String(used)} hint="Em pelo menos um orçamento" />
        <Summary
          label="Faixa de preço"
          value={
            prices.length ? `${formatBRL(Math.min(...prices))} a ${formatBRL(Math.max(...prices))}` : "-"
          }
          hint="Entre os procedimentos ativos"
          small
        />
      </div>

      <ProceduresManager
        dental={hasModule("odontogram")}
        procedures={procedures.map((p) => ({
          id: p.id,
          name: p.name,
          priceCents: p.priceCents,
          effect: p.effect,
          perTooth: p.perTooth,
          isActive: p.isActive,
          uses: uses.get(p.id) ?? 0,
        }))}
      />
    </>
  )
}

function Summary({
  label,
  value,
  hint,
  small,
}: {
  label: string
  value: string
  hint: string
  small?: boolean
}) {
  return (
    <div className="grid gap-1.5 rounded-[13px] border bg-card p-[18px]">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <strong
        className={
          small
            ? "text-lg leading-tight font-bold text-primary tabular-nums dark:text-foreground"
            : "text-[28px] leading-none font-bold text-primary tabular-nums dark:text-foreground"
        }
      >
        {value}
      </strong>
      <small className="text-xs text-muted-foreground">{hint}</small>
    </div>
  )
}
