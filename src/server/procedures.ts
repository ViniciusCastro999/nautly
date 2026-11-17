"use server"

import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { isProcedureEffect } from "@/lib/dental"
import { parseBRL } from "@/lib/documents/money"
import { requirePermission } from "@/lib/session"

const PATH = "/app/procedures"

const procedureSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  price: z.string().transform((v, c) => {
    const cents = parseBRL(v)
    if (cents === null || cents < 0) {
      c.addIssue({ code: "custom", message: "Preço inválido." })
      return z.NEVER
    }
    return cents
  }),
  effect: z
    .string()
    .optional()
    .transform((v) => (v && isProcedureEffect(v) ? v : null)),
  perTooth: z.boolean().default(false),
})

async function requireCatalog() {
  const ctx = await requirePermission("settings:manage")
  if (!ctx.hasModule("treatment_plan")) throw new Error("Módulo de orçamentos desativado.")
  return ctx
}

export async function saveProcedure(input: z.input<typeof procedureSchema>) {
  const ctx = await requireCatalog()
  const parsed = procedureSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  const { id, name, price, perTooth } = parsed.data
  // Efeito no odontograma só faz sentido para procedimento por dente.
  const effect = perTooth && ctx.hasModule("odontogram") ? parsed.data.effect : null
  const values = { name, priceCents: price, effect, perTooth }

  if (id) {
    const [row] = await db
      .update(schema.procedure)
      .set(values)
      .where(and(eq(schema.procedure.id, id), eq(schema.procedure.organizationId, ctx.org.id)))
      .returning({ id: schema.procedure.id })
    if (!row) return { ok: false as const, error: "Procedimento não encontrado." }
  } else {
    await db.insert(schema.procedure).values({ organizationId: ctx.org.id, ...values })
  }
  revalidatePath(PATH)
  return { ok: true as const }
}

/** Arquivar em vez de apagar: orçamentos antigos continuam com o nome e preço gravados. */
export async function setProcedureActive(id: string, isActive: boolean) {
  const ctx = await requireCatalog()
  await db
    .update(schema.procedure)
    .set({ isActive })
    .where(and(eq(schema.procedure.id, id), eq(schema.procedure.organizationId, ctx.org.id)))
  revalidatePath(PATH)
  return { ok: true as const }
}

/** Troca só o preço, direto na lista. */
export async function updateProcedurePrice(id: string, price: string) {
  const ctx = await requireCatalog()
  const cents = parseBRL(price)
  if (cents === null) return { ok: false as const, error: "Preço inválido. Use, por exemplo, 250,00." }
  const [row] = await db
    .update(schema.procedure)
    .set({ priceCents: cents })
    .where(and(eq(schema.procedure.id, id), eq(schema.procedure.organizationId, ctx.org.id)))
    .returning({ priceCents: schema.procedure.priceCents })
  if (!row) return { ok: false as const, error: "Procedimento não encontrado." }
  revalidatePath(PATH)
  return { ok: true as const, priceCents: row.priceCents }
}

const adjustSchema = z.object({
  percent: z.number().min(-90, "Redução máxima de 90%.").max(500, "Aumento máximo de 500%."),
  /** Arredonda para múltiplos deste valor em centavos (100 = R$ 1, 500 = R$ 5). */
  roundToCents: z.union([z.literal(1), z.literal(100), z.literal(500), z.literal(1000)]),
})

/** Reajuste em lote dos procedimentos ativos. Orçamentos já criados não mudam. */
export async function adjustProcedurePrices(input: z.input<typeof adjustSchema>) {
  const ctx = await requireCatalog()
  const parsed = adjustSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  const { percent, roundToCents } = parsed.data
  if (percent === 0) return { ok: false as const, error: "Informe um percentual diferente de zero." }

  const factor = 1 + percent / 100
  const rows = await db
    .update(schema.procedure)
    .set({
      priceCents: sql`greatest(0, (round(${schema.procedure.priceCents} * ${factor}::numeric / ${roundToCents}) * ${roundToCents})::int)`,
    })
    .where(and(eq(schema.procedure.organizationId, ctx.org.id), eq(schema.procedure.isActive, true)))
    .returning({ id: schema.procedure.id })
  revalidatePath(PATH)
  return { ok: true as const, count: rows.length }
}
