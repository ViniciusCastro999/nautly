"use server"

import { TZDate } from "@date-fns/tz"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { requirePermission } from "@/lib/session"

const paymentSchema = z.object({
  contactId: z.string().min(1, "Escolha o paciente."),
  bookingId: z.string().optional(),
  amountCents: z.number().int().min(1, "Informe o valor.").max(99_999_999, "Valor muito alto."),
  method: z.enum(schema.paymentMethod.enumValues),
  /** Data do pagamento (yyyy-MM-dd), no fuso de quem registra. */
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  description: z.string().trim().max(200).optional(),
})

function revalidate() {
  revalidatePath("/app/finance")
  revalidatePath("/app")
}

export async function recordPayment(input: z.input<typeof paymentSchema>) {
  const { org, user } = await requirePermission("finance:manage")
  const parsed = paymentSchema.safeParse(input)
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
      where: and(
        eq(schema.booking.id, data.bookingId),
        eq(schema.booking.contactId, contact.id),
        eq(schema.booking.organizationId, org.id),
      ),
    })
    if (!b) return { ok: false as const, error: "Atendimento não encontrado." }
    const paid = await db.query.payment.findFirst({ where: eq(schema.payment.bookingId, b.id) })
    if (paid) return { ok: false as const, error: "Esse atendimento já tem pagamento registrado." }
    bookingId = b.id
  }

  // Meio-dia no fuso de quem registra: a data não "pula" de dia na conversão.
  const [y, m, d] = data.paidOn.split("-").map(Number)
  const paidAt = new Date(new TZDate(y, m - 1, d, 12, 0, 0, user.timezone).getTime())

  await db.insert(schema.payment).values({
    organizationId: org.id,
    contactId: contact.id,
    bookingId,
    amountCents: data.amountCents,
    method: data.method,
    paidAt,
    description: data.description || null,
    createdById: user.id,
  })
  revalidate()
  return { ok: true as const }
}

export async function deletePayment(id: string) {
  const { org } = await requirePermission("finance:manage")
  const [row] = await db
    .delete(schema.payment)
    .where(and(eq(schema.payment.id, id), eq(schema.payment.organizationId, org.id)))
    .returning({ id: schema.payment.id })
  if (!row) return { ok: false as const, error: "Pagamento não encontrado." }
  revalidate()
  return { ok: true as const }
}
