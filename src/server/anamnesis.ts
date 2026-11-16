"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db, schema } from "@/db"
import { getTemplate, templateForVertical, validateAnswers } from "@/lib/anamnesis"
import { logAccess } from "@/lib/audit"
import { encryptText } from "@/lib/crypto"
import { requirePermission } from "@/lib/session"

type SubmitResult = { ok: true } | { ok: false; error: string; errors?: Record<string, string> }

/** Cria uma anamnese pendente e devolve o link público de preenchimento. */
export async function requestAnamnesis(contactId: string) {
  const ctx = await requirePermission("clinical:write")
  if (!ctx.hasModule("anamnesis")) return { ok: false as const, error: "Módulo de anamnese desativado." }
  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, contactId), eq(schema.contact.organizationId, ctx.org.id)),
  })
  if (!contact) return { ok: false as const, error: "Cadastro não encontrado." }

  const [row] = await db
    .insert(schema.anamnesis)
    .values({
      organizationId: ctx.org.id,
      contactId,
      templateId: templateForVertical(ctx.vertical.id).id,
      requestedById: ctx.user.id,
    })
    .returning({ id: schema.anamnesis.id, token: schema.anamnesis.token })
  revalidatePath(`/app/contacts/${contactId}`)
  return { ok: true as const, ...row }
}

/** Preenchimento pelo profissional (ex.: durante a consulta). */
export async function fillAnamnesis(id: string, raw: Record<string, unknown>): Promise<SubmitResult> {
  const ctx = await requirePermission("clinical:write")
  const row = await db.query.anamnesis.findFirst({
    where: and(eq(schema.anamnesis.id, id), eq(schema.anamnesis.organizationId, ctx.org.id)),
  })
  if (!row) return { ok: false, error: "Anamnese não encontrada." }
  if (row.status === "completed") return { ok: false, error: "Esta anamnese já foi preenchida." }

  const res = await complete(row, raw, "professional")
  if (res.ok) {
    await logAccess({
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      contactId: row.contactId,
      action: "anamnesis_filled",
      targetId: row.id,
    })
    revalidatePath(`/app/contacts/${row.contactId}`)
  }
  return res
}

/** Preenchimento pelo próprio paciente, pelo link público. Sem login: o token é a credencial. */
export async function submitPublicAnamnesis(
  token: string,
  raw: Record<string, unknown>,
): Promise<SubmitResult> {
  if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false, error: "Link inválido." }
  const row = await db.query.anamnesis.findFirst({ where: eq(schema.anamnesis.token, token) })
  if (!row || row.status === "completed") return { ok: false, error: "Este link já foi usado ou expirou." }

  const res = await complete(row, raw, "patient")
  if (res.ok) {
    await logAccess({
      organizationId: row.organizationId,
      userId: null,
      contactId: row.contactId,
      action: "anamnesis_filled",
      targetId: row.id,
    })
  }
  return res
}

async function complete(
  row: typeof schema.anamnesis.$inferSelect,
  raw: Record<string, unknown>,
  filledBy: "patient" | "professional",
): Promise<SubmitResult> {
  const validated = validateAnswers(getTemplate(row.templateId), raw)
  if (!validated.ok) return { ok: false, error: "Revise os campos destacados.", errors: validated.errors }

  // A condição de status evita que duas submissões simultâneas sobrescrevam uma à outra.
  const updated = await db
    .update(schema.anamnesis)
    .set({
      status: "completed",
      answersEncrypted: encryptText(JSON.stringify(validated.answers)),
      filledBy,
      completedAt: new Date(),
    })
    .where(and(eq(schema.anamnesis.id, row.id), eq(schema.anamnesis.status, "pending")))
    .returning({ id: schema.anamnesis.id })
  if (updated.length === 0) return { ok: false, error: "Esta anamnese já foi preenchida." }
  return { ok: true }
}
