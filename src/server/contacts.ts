"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { requirePermission } from "@/lib/session"

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.union([z.email("E-mail inválido."), z.literal("")]).optional(),
  phone: z.string().trim().max(30).optional(),
  birthDate: z.union([z.iso.date(), z.literal("")]).optional(),
  document: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type ContactInput = z.input<typeof contactSchema>

export async function saveContact(input: ContactInput) {
  const { org } = await requirePermission("clients:write")
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  const { id, ...data } = parsed.data

  const values = {
    name: data.name,
    email: data.email ? data.email.toLowerCase() : null,
    phone: data.phone || null,
    birthDate: data.birthDate || null,
    document: data.document || null,
    notes: data.notes || null,
  }

  try {
    if (id) {
      await db
        .update(schema.contact)
        .set(values)
        .where(and(eq(schema.contact.id, id), eq(schema.contact.organizationId, org.id)))
      revalidatePath(`/app/contacts/${id}`)
      return { ok: true as const, id }
    }
    const [created] = await db
      .insert(schema.contact)
      .values({ ...values, organizationId: org.id })
      .returning({ id: schema.contact.id })
    revalidatePath("/app/contacts")
    return { ok: true as const, id: created.id }
  } catch {
    return { ok: false as const, error: "Já existe um cadastro com esse e-mail." }
  }
}
