"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { logAccess } from "@/lib/audit"
import { isSurfaceCondition, isToothStatus, isValidTooth, SURFACES } from "@/lib/dental"
import { requirePermission } from "@/lib/session"

const toothSchema = z.object({
  contactId: z.string().min(1),
  tooth: z.number().refine(isValidTooth, "Dente inválido."),
  status: z.string().refine(isToothStatus, "Situação inválida."),
  surfaces: z
    .partialRecord(z.enum(SURFACES), z.string().refine(isSurfaceCondition, "Condição inválida."))
    .default({}),
  notes: z.string().trim().max(500).optional(),
})

export async function saveTooth(input: z.input<typeof toothSchema>) {
  const ctx = await requirePermission("clinical:write")
  if (!ctx.hasModule("odontogram")) return { ok: false as const, error: "Módulo de odontograma desativado." }
  const parsed = toothSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  const data = parsed.data

  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, data.contactId), eq(schema.contact.organizationId, ctx.org.id)),
  })
  if (!contact) return { ok: false as const, error: "Cadastro não encontrado." }

  // Dente ausente ou com prótese não tem faces.
  const surfaces = ["missing", "implant", "crown"].includes(data.status) ? {} : data.surfaces
  const values = { status: data.status, surfaces, notes: data.notes || null, updatedById: ctx.user.id }

  await db
    .insert(schema.toothRecord)
    .values({ organizationId: ctx.org.id, contactId: contact.id, tooth: data.tooth, ...values })
    .onConflictDoUpdate({ target: [schema.toothRecord.contactId, schema.toothRecord.tooth], set: values })

  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: contact.id,
    action: "odontogram_updated",
    targetId: String(data.tooth),
  })
  revalidatePath(`/app/contacts/${contact.id}`)
  return { ok: true as const }
}
