import "server-only"
import { asc, eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { formatBRL } from "@/lib/documents/money"
import { renderBudgetPdf } from "@/lib/documents/pdf"
import { formatInTz } from "@/lib/format"
import { planTotals } from "@/lib/treatment"

/** Carrega um plano com tudo que o orçamento precisa. A checagem de acesso fica com quem chama. */
export async function loadBudget(where: { id: string } | { token: string }) {
  const plan = await db.query.treatmentPlan.findFirst({
    where:
      "id" in where
        ? eq(schema.treatmentPlan.id, where.id)
        : eq(schema.treatmentPlan.approvalToken, where.token),
    with: {
      items: { orderBy: [asc(schema.treatmentItem.position)] },
      contact: true,
      createdBy: true,
      organization: true,
    },
  })
  if (!plan) return null
  const totals = planTotals(
    plan.items.map((i) => ({ priceCents: i.priceCents, done: Boolean(i.doneAt) })),
    plan.discountCents,
  )
  const tz = plan.createdBy.timezone
  const dateLabel = (d: string) => formatInTz(`${d}T12:00:00Z`, "UTC", "dd/MM/yyyy")
  return {
    plan,
    totals,
    timezone: tz,
    createdOn: formatInTz(plan.createdAt, tz, "dd/MM/yyyy"),
    validUntil: plan.validUntil ? dateLabel(plan.validUntil) : null,
    expired: Boolean(plan.validUntil && plan.validUntil < formatInTz(new Date(), tz, "yyyy-MM-dd")),
    approval: plan.approvedAt
      ? `Aprovado por ${plan.approvedByName} em ${formatInTz(plan.approvedAt, tz, "dd/MM/yyyy 'às' HH:mm")}` +
        (plan.approvedIp ? ` (IP ${plan.approvedIp})` : "")
      : null,
    items: plan.items.map((i) => ({
      description: i.description,
      detail: i.tooth ? `Dente ${i.tooth}${i.surfaces ? `, faces ${i.surfaces}` : ""}` : null,
      priceCents: i.priceCents,
      price: formatBRL(i.priceCents),
    })),
  }
}

export type Budget = NonNullable<Awaited<ReturnType<typeof loadBudget>>>

export async function budgetPdfResponse(b: Budget) {
  const { plan } = b
  const pdf = await renderBudgetPdf({
    professional: {
      name: plan.createdBy.name,
      registry: plan.createdBy.professionalRegistry,
      taxId: plan.createdBy.taxId,
      address: plan.createdBy.address,
    },
    organizationName: plan.organization.name,
    patient: { name: plan.contact.name, document: plan.contact.document },
    title: plan.title,
    createdOn: b.createdOn,
    validUntil: b.validUntil,
    items: b.items,
    subtotalCents: b.totals.subtotal,
    discountCents: b.totals.discount,
    totalCents: b.totals.total,
    notes: plan.notes,
    approval: b.approval,
    generatedAtLabel: formatInTz(new Date(), b.timezone, "dd/MM/yyyy 'às' HH:mm"),
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orcamento.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
