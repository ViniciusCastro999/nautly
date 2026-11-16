"use server"

import { and, eq, isNull, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { logAccess } from "@/lib/audit"
import {
  applyEffect,
  isProcedureEffect,
  isSurfaceCondition,
  isToothStatus,
  isValidTooth,
  parseSurfaces,
} from "@/lib/dental"
import type { ToothState } from "@/lib/dental"
import { parseBRL } from "@/lib/documents/money"
import { requirePermission } from "@/lib/session"
import { canEditItems, canExecute, statusAfterExecution } from "@/lib/treatment"

type Ctx = Awaited<ReturnType<typeof requirePermission>>
const fail = (error: string) => ({ ok: false as const, error })

async function requirePlans() {
  const ctx = await requirePermission("clinical:write")
  if (!ctx.hasModule("treatment_plan")) throw new Error("Módulo de orçamentos desativado.")
  return ctx
}

async function loadPlan(ctx: Ctx, planId: string) {
  return db.query.treatmentPlan.findFirst({
    where: and(eq(schema.treatmentPlan.id, planId), eq(schema.treatmentPlan.organizationId, ctx.org.id)),
  })
}

function refresh(contactId: string) {
  revalidatePath(`/app/contacts/${contactId}`)
}

async function touch(planId: string) {
  await db
    .update(schema.treatmentPlan)
    .set({ updatedAt: new Date() })
    .where(eq(schema.treatmentPlan.id, planId))
}

/* -------------------------------------------------------------------------- */
/*                                   Plano                                    */
/* -------------------------------------------------------------------------- */

export async function createPlan(input: { contactId: string; title: string }) {
  const ctx = await requirePlans()
  const title = input.title.trim() || "Plano de tratamento"
  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, input.contactId), eq(schema.contact.organizationId, ctx.org.id)),
  })
  if (!contact) return fail("Cadastro não encontrado.")

  const [plan] = await db
    .insert(schema.treatmentPlan)
    .values({
      organizationId: ctx.org.id,
      contactId: contact.id,
      createdById: ctx.user.id,
      title: title.slice(0, 120),
    })
    .returning({ id: schema.treatmentPlan.id })
  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: contact.id,
    action: "treatment_plan_updated",
    targetId: plan.id,
  })
  refresh(contact.id)
  return { ok: true as const, id: plan.id }
}

const planDetailsSchema = z.object({
  planId: z.string().min(1),
  title: z.string().trim().min(1, "Informe o título.").max(120),
  discount: z.string().transform((v, c) => {
    if (!v.trim()) return 0
    const cents = parseBRL(v)
    if (cents === null || cents < 0) {
      c.addIssue({ code: "custom", message: "Desconto inválido." })
      return z.NEVER
    }
    return cents
  }),
  validUntil: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
  notes: z.string().trim().max(2000),
})

export async function updatePlanDetails(input: z.input<typeof planDetailsSchema>) {
  const ctx = await requirePlans()
  const parsed = planDetailsSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.")
  const plan = await loadPlan(ctx, parsed.data.planId)
  if (!plan) return fail("Plano não encontrado.")
  if (!canEditItems(plan.status)) return fail("Plano já aprovado não pode ser alterado.")

  const { title, discount, validUntil, notes } = parsed.data
  await db
    .update(schema.treatmentPlan)
    .set({ title, discountCents: discount, validUntil, notes: notes || null })
    .where(eq(schema.treatmentPlan.id, plan.id))
  refresh(plan.contactId)
  return { ok: true as const }
}

/** Envia para aprovação do paciente (gera o link público). */
export async function presentPlan(planId: string) {
  const ctx = await requirePlans()
  const plan = await loadPlan(ctx, planId)
  if (!plan) return fail("Plano não encontrado.")
  if (plan.status !== "draft" && plan.status !== "rejected") return fail("Este plano já foi apresentado.")
  const items = await db.$count(schema.treatmentItem, eq(schema.treatmentItem.planId, plan.id))
  if (items === 0) return fail("Adicione ao menos um procedimento.")

  await db
    .update(schema.treatmentPlan)
    .set({ status: "presented" })
    .where(eq(schema.treatmentPlan.id, plan.id))
  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: plan.contactId,
    action: "treatment_plan_updated",
    targetId: plan.id,
  })
  refresh(plan.contactId)
  return { ok: true as const, token: plan.approvalToken }
}

/** Volta para rascunho para ajustar itens. */
export async function reopenPlan(planId: string) {
  const ctx = await requirePlans()
  const plan = await loadPlan(ctx, planId)
  if (!plan) return fail("Plano não encontrado.")
  if (plan.status !== "presented" && plan.status !== "rejected")
    return fail("Este plano não pode ser reaberto.")
  await db.update(schema.treatmentPlan).set({ status: "draft" }).where(eq(schema.treatmentPlan.id, plan.id))
  refresh(plan.contactId)
  return { ok: true as const }
}

/** Aprovação registrada pelo profissional (paciente aprovou no consultório). */
export async function approveInPerson(planId: string) {
  const ctx = await requirePlans()
  const plan = await loadPlan(ctx, planId)
  if (!plan) return fail("Plano não encontrado.")
  if (plan.status !== "presented") return fail("Apresente o plano antes de registrar a aprovação.")
  const contact = await db.query.contact.findFirst({ where: eq(schema.contact.id, plan.contactId) })

  await db
    .update(schema.treatmentPlan)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedByName: `${contact?.name ?? "Paciente"} (registrado por ${ctx.user.name})`,
      approvedIp: null,
    })
    .where(and(eq(schema.treatmentPlan.id, plan.id), eq(schema.treatmentPlan.status, "presented")))
  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: plan.contactId,
    action: "treatment_plan_approved",
    targetId: plan.id,
  })
  refresh(plan.contactId)
  return { ok: true as const }
}

export async function deletePlan(planId: string) {
  const ctx = await requirePlans()
  const plan = await loadPlan(ctx, planId)
  if (!plan) return fail("Plano não encontrado.")
  if (plan.status === "approved" || plan.status === "completed") {
    return fail("Planos aprovados ficam no histórico e não podem ser excluídos.")
  }
  await db.delete(schema.treatmentPlan).where(eq(schema.treatmentPlan.id, plan.id))
  refresh(plan.contactId)
  return { ok: true as const }
}

/* -------------------------------------------------------------------------- */
/*                                   Itens                                    */
/* -------------------------------------------------------------------------- */

const itemSchema = z.object({
  planId: z.string().min(1),
  procedureId: z.string().optional(),
  description: z.string().trim().max(200).optional(),
  tooth: z.number().nullable().optional(),
  surfaces: z.string().max(10).optional(),
  price: z.string().optional(),
})

export async function addItem(input: z.input<typeof itemSchema>) {
  const ctx = await requirePlans()
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) return fail("Dados inválidos.")
  const data = parsed.data
  const plan = await loadPlan(ctx, data.planId)
  if (!plan) return fail("Plano não encontrado.")
  if (!canEditItems(plan.status)) return fail("Plano já aprovado não pode ser alterado.")

  const proc = data.procedureId
    ? await db.query.procedure.findFirst({
        where: and(
          eq(schema.procedure.id, data.procedureId),
          eq(schema.procedure.organizationId, ctx.org.id),
        ),
      })
    : null
  if (data.procedureId && !proc) return fail("Procedimento não encontrado.")

  const description = data.description || proc?.name
  if (!description) return fail("Escolha um procedimento ou descreva o item.")

  let priceCents = proc?.priceCents ?? null
  if (data.price?.trim()) priceCents = parseBRL(data.price)
  if (priceCents === null || priceCents < 0) return fail("Preço inválido.")

  const tooth = data.tooth ?? null
  if (tooth !== null && !isValidTooth(tooth)) return fail("Dente inválido.")
  if (proc?.perTooth && tooth === null && ctx.hasModule("odontogram")) return fail("Informe o dente.")
  const surfaces = tooth !== null ? parseSurfaces(data.surfaces).join("") || null : null
  if (proc?.effect && ["restoration", "sealant"].includes(proc.effect) && tooth !== null && !surfaces) {
    return fail("Informe as faces do dente (ex.: MO).")
  }

  const [{ position }] = await db
    .select({ position: sql<number>`coalesce(max(${schema.treatmentItem.position}), -1) + 1` })
    .from(schema.treatmentItem)
    .where(eq(schema.treatmentItem.planId, plan.id))

  await db.insert(schema.treatmentItem).values({
    planId: plan.id,
    procedureId: proc?.id ?? null,
    description: description.slice(0, 200),
    tooth,
    surfaces,
    priceCents,
    position,
  })
  await touch(plan.id)
  refresh(plan.contactId)
  return { ok: true as const }
}

async function loadItem(ctx: Ctx, itemId: string) {
  const item = await db.query.treatmentItem.findFirst({
    where: eq(schema.treatmentItem.id, itemId),
    with: { plan: true, procedure: true },
  })
  if (!item || item.plan.organizationId !== ctx.org.id) return null
  return item
}

export async function removeItem(itemId: string) {
  const ctx = await requirePlans()
  const item = await loadItem(ctx, itemId)
  if (!item) return fail("Item não encontrado.")
  if (!canEditItems(item.plan.status)) return fail("Plano já aprovado não pode ser alterado.")
  await db.delete(schema.treatmentItem).where(eq(schema.treatmentItem.id, item.id))
  await touch(item.planId)
  refresh(item.plan.contactId)
  return { ok: true as const }
}

/**
 * Marca um procedimento como realizado. Se ele tem efeito no odontograma e um
 * dente, a ficha do dente é atualizada na mesma transação. Desmarcar não
 * desfaz o odontograma: o dentista corrige manualmente se precisar.
 */
export async function setItemDone(itemId: string, done: boolean) {
  const ctx = await requirePlans()
  const item = await loadItem(ctx, itemId)
  if (!item) return fail("Item não encontrado.")
  if (!canExecute(item.plan.status)) return fail("O plano precisa ser aprovado antes da execução.")
  if (Boolean(item.doneAt) === done) return { ok: true as const, toothUpdated: false }

  let toothUpdated = false
  await db.transaction(async (tx) => {
    await tx
      .update(schema.treatmentItem)
      .set(done ? { doneAt: new Date(), doneById: ctx.user.id } : { doneAt: null, doneById: null })
      .where(eq(schema.treatmentItem.id, item.id))

    const effect = item.procedure?.effect
    if (done && item.tooth !== null && isProcedureEffect(effect) && ctx.hasModule("odontogram")) {
      const current = await tx.query.toothRecord.findFirst({
        where: and(
          eq(schema.toothRecord.contactId, item.plan.contactId),
          eq(schema.toothRecord.tooth, item.tooth),
        ),
      })
      const state: ToothState = {
        status: isToothStatus(current?.status) ? current.status : "healthy",
        surfaces: Object.fromEntries(
          Object.entries(current?.surfaces ?? {}).filter(([, c]) => isSurfaceCondition(c)),
        ) as ToothState["surfaces"],
      }
      const next = applyEffect(state, effect, parseSurfaces(item.surfaces))
      const values = {
        status: next.status,
        surfaces: next.surfaces as Record<string, string>,
        updatedById: ctx.user.id,
      }
      await tx
        .insert(schema.toothRecord)
        .values({
          organizationId: ctx.org.id,
          contactId: item.plan.contactId,
          tooth: item.tooth,
          notes: current?.notes,
          ...values,
        })
        .onConflictDoUpdate({ target: [schema.toothRecord.contactId, schema.toothRecord.tooth], set: values })
      toothUpdated = true
    }

    const [{ remaining }] = await tx
      .select({ remaining: sql<number>`count(*)::int` })
      .from(schema.treatmentItem)
      .where(and(eq(schema.treatmentItem.planId, item.planId), isNull(schema.treatmentItem.doneAt)))
    const status = statusAfterExecution(item.plan.status, remaining === 0)
    await tx
      .update(schema.treatmentPlan)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.treatmentPlan.id, item.planId))
  })

  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: item.plan.contactId,
    action: toothUpdated ? "odontogram_updated" : "treatment_plan_updated",
    targetId: toothUpdated ? String(item.tooth) : item.planId,
  })
  refresh(item.plan.contactId)
  return { ok: true as const, toothUpdated }
}

/* -------------------------------------------------------------------------- */
/*                         Aprovação pelo link público                        */
/* -------------------------------------------------------------------------- */

const approvalSchema = z.object({
  token: z.string().min(10),
  decision: z.enum(["approve", "reject"]),
  name: z.string().trim().max(120),
})

export async function answerPlanByToken(input: z.input<typeof approvalSchema>) {
  const parsed = approvalSchema.safeParse(input)
  if (!parsed.success) return fail("Dados inválidos.")
  const { token, decision, name } = parsed.data
  if (decision === "approve" && name.length < 3) return fail("Digite seu nome completo para aprovar.")

  const plan = await db.query.treatmentPlan.findFirst({
    where: eq(schema.treatmentPlan.approvalToken, token),
  })
  if (!plan || plan.status !== "presented") return fail("Este orçamento não está mais aguardando resposta.")
  if (plan.validUntil && plan.validUntil < new Date().toISOString().slice(0, 10)) {
    return fail("Este orçamento expirou. Peça um novo ao consultório.")
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null

  const [updated] = await db
    .update(schema.treatmentPlan)
    .set(
      decision === "approve"
        ? { status: "approved", approvedAt: new Date(), approvedByName: name, approvedIp: ip }
        : { status: "rejected" },
    )
    // Só uma resposta vale, mesmo com cliques simultâneos.
    .where(and(eq(schema.treatmentPlan.id, plan.id), eq(schema.treatmentPlan.status, "presented")))
    .returning({ id: schema.treatmentPlan.id })
  if (!updated) return fail("Este orçamento já foi respondido.")

  await logAccess({
    organizationId: plan.organizationId,
    userId: null,
    contactId: plan.contactId,
    action: decision === "approve" ? "treatment_plan_approved" : "treatment_plan_updated",
    targetId: plan.id,
  })
  revalidatePath(`/orcamento/${token}`)
  refresh(plan.contactId)
  return { ok: true as const }
}
