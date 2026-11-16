"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { logAccess } from "@/lib/audit"
import { encryptText } from "@/lib/crypto"
import { requireWorkspace } from "@/lib/session"

async function requireRecords() {
  const ctx = await requireWorkspace()
  if (!ctx.hasModule("records") || !ctx.can("clinical:write")) {
    throw new Error("Sem permissão para o prontuário.")
  }
  return ctx
}

const noteSchema = z.object({
  contactId: z.string().min(1),
  content: z.string().trim().min(1, "Escreva o registro.").max(20_000),
  isPrivate: z.boolean().default(false),
  bookingId: z.string().optional(),
})

export async function createNote(input: z.input<typeof noteSchema>) {
  const { org, user } = await requireRecords()
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  const data = parsed.data

  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, data.contactId), eq(schema.contact.organizationId, org.id)),
  })
  if (!contact) return { ok: false as const, error: "Cadastro não encontrado." }

  let bookingId: string | null = null
  if (data.bookingId) {
    const b = await db.query.booking.findFirst({
      where: and(eq(schema.booking.id, data.bookingId), eq(schema.booking.contactId, contact.id)),
    })
    bookingId = b?.id ?? null
  }

  const [note] = await db
    .insert(schema.clinicalNote)
    .values({
      organizationId: org.id,
      contactId: contact.id,
      authorId: user.id,
      bookingId,
      isPrivate: data.isPrivate,
      contentEncrypted: encryptText(data.content),
    })
    .returning({ id: schema.clinicalNote.id })

  await logAccess({
    organizationId: org.id,
    userId: user.id,
    contactId: contact.id,
    action: "note_created",
    targetId: note.id,
  })
  revalidatePath(`/app/contacts/${contact.id}`)
  return { ok: true as const }
}

/** Registros clínicos não são apagados: apenas o autor pode editar. */
export async function updateNote(id: string, content: string) {
  const { org, user } = await requireRecords()
  const text = content.trim()
  if (!text) return { ok: false as const, error: "O registro não pode ficar vazio." }

  const [note] = await db
    .update(schema.clinicalNote)
    .set({ contentEncrypted: encryptText(text.slice(0, 20_000)) })
    .where(
      and(
        eq(schema.clinicalNote.id, id),
        eq(schema.clinicalNote.organizationId, org.id),
        eq(schema.clinicalNote.authorId, user.id),
      ),
    )
    .returning({ contactId: schema.clinicalNote.contactId })
  if (!note) return { ok: false as const, error: "Só o autor pode editar este registro." }

  await logAccess({
    organizationId: org.id,
    userId: user.id,
    contactId: note.contactId,
    action: "note_updated",
    targetId: id,
  })
  revalidatePath(`/app/contacts/${note.contactId}`)
  return { ok: true as const }
}
