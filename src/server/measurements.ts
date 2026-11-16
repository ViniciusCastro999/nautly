"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { INPUT_METRICS, METRICS } from "@/lib/anthropometry"
import { logAccess } from "@/lib/audit"
import { requirePermission } from "@/lib/session"

/** "72,4" ou "72.4" → 72.4; vazio → null. */
const metric = (key: (typeof INPUT_METRICS)[number]) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))),
    z
      .number({ error: `${METRICS[key].label} inválido.` })
      .min(METRICS[key].min, `${METRICS[key].label} fora do intervalo.`)
      .max(METRICS[key].max, `${METRICS[key].label} fora do intervalo.`)
      .nullable(),
  )

const measurementSchema = z
  .object({
    contactId: z.string().min(1),
    measuredOn: z.iso.date(),
    ...Object.fromEntries(INPUT_METRICS.map((k) => [k, metric(k)])),
  })
  .transform((v) => v as typeof v & Record<(typeof INPUT_METRICS)[number], number | null>)

async function requireAnthropometry() {
  const ctx = await requirePermission("clinical:write")
  if (!ctx.hasModule("anthropometry")) throw new Error("Módulo de avaliação desativado.")
  return ctx
}

export async function createMeasurement(input: Record<string, string>) {
  const ctx = await requireAnthropometry()
  const parsed = measurementSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  const data = parsed.data
  if (INPUT_METRICS.every((k) => data[k] === null)) {
    return { ok: false as const, error: "Preencha ao menos uma medida." }
  }

  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, data.contactId), eq(schema.contact.organizationId, ctx.org.id)),
  })
  if (!contact) return { ok: false as const, error: "Cadastro não encontrado." }

  const [row] = await db
    .insert(schema.measurement)
    .values({
      organizationId: ctx.org.id,
      contactId: contact.id,
      authorId: ctx.user.id,
      measuredOn: data.measuredOn,
      ...Object.fromEntries(INPUT_METRICS.map((k) => [k, data[k]])),
    })
    .returning({ id: schema.measurement.id })

  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: contact.id,
    action: "measurement_created",
    targetId: row.id,
  })
  revalidatePath(`/app/contacts/${contact.id}`)
  return { ok: true as const }
}

/** Remove uma avaliação lançada por engano. Só o autor pode remover. */
export async function deleteMeasurement(id: string) {
  const ctx = await requireAnthropometry()
  const [row] = await db
    .delete(schema.measurement)
    .where(
      and(
        eq(schema.measurement.id, id),
        eq(schema.measurement.organizationId, ctx.org.id),
        eq(schema.measurement.authorId, ctx.user.id),
      ),
    )
    .returning({ contactId: schema.measurement.contactId })
  if (row) revalidatePath(`/app/contacts/${row.contactId}`)
  return { ok: Boolean(row) }
}
