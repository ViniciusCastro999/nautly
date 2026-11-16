"use server"

import { and, asc, eq, inArray, lte, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { logAccess } from "@/lib/audit"
import { canIssueClinicalDocs, PRESCRIPTION_USAGES } from "@/lib/documents/kinds"
import type { DocumentPayload, Professional } from "@/lib/documents/pdf"
import { formatInTz } from "@/lib/format"
import { requirePermission } from "@/lib/session"

const issueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("receipt"),
    contactId: z.string().min(1),
    bookingIds: z.array(z.string()).min(1, "Escolha ao menos um atendimento.").max(60),
    totalCents: z.number().int().min(1, "Informe o valor.").max(99_999_999, "Valor muito alto."),
    paymentMethod: z.string().trim().max(60).optional(),
  }),
  z.object({
    kind: z.literal("attendance"),
    contactId: z.string().min(1),
    bookingIds: z.array(z.string()).length(1, "Escolha um atendimento."),
  }),
  z.object({
    kind: z.literal("certificate"),
    contactId: z.string().min(1),
    bookingIds: z.array(z.string()).length(1, "Escolha um atendimento."),
    days: z.number().int().min(0, "Dias inválidos.").max(365, "Dias inválidos."),
    cid: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z]\d{2}(\.\d{1,2})?)?$/, "CID inválido (ex.: J06.9).")
      .optional(),
  }),
  z.object({
    kind: z.literal("prescription"),
    contactId: z.string().min(1),
    bookingIds: z.array(z.string()).max(0).default([]),
    usage: z.enum(PRESCRIPTION_USAGES),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Informe o medicamento.").max(160),
          instructions: z.string().trim().min(3, "Informe a posologia.").max(500),
        }),
      )
      .min(1, "Adicione ao menos um item.")
      .max(12, "Máximo de 12 itens."),
    notes: z.string().trim().max(1000).optional(),
  }),
])

export async function issueDocument(input: z.input<typeof issueSchema>) {
  const ctx = await requirePermission("clients:write")
  if (!ctx.hasModule("documents")) return { ok: false as const, error: "Módulo de documentos desativado." }
  const parsed = issueSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  const data = parsed.data
  if (data.kind === "certificate" || data.kind === "prescription") {
    // Atestado e receita revelam informação de saúde e exigem registro no conselho.
    if (!canIssueClinicalDocs(ctx.vertical.id) || !ctx.can("clinical:write")) {
      return { ok: false as const, error: "Sem permissão para emitir este documento." }
    }
    if (!ctx.user.professionalRegistry) {
      return { ok: false as const, error: "Informe seu registro profissional em Configurações." }
    }
  }

  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, data.contactId), eq(schema.contact.organizationId, ctx.org.id)),
  })
  if (!contact) return { ok: false as const, error: "Cadastro não encontrado." }

  // Só atendimentos realizados deste paciente; faltas não entram em documentos.
  const bookings = data.bookingIds.length
    ? await db.query.booking.findMany({
        where: and(
          inArray(schema.booking.id, data.bookingIds),
          eq(schema.booking.contactId, contact.id),
          eq(schema.booking.organizationId, ctx.org.id),
          eq(schema.booking.status, "confirmed"),
          lte(schema.booking.startsAt, new Date()),
        ),
        with: { eventType: true },
        orderBy: [asc(schema.booking.startsAt)],
      })
    : []
  if (bookings.length !== data.bookingIds.length || bookings.some((b) => b.attendance === "no_show")) {
    return { ok: false as const, error: "Algum atendimento escolhido não é válido." }
  }

  const tz = ctx.user.timezone
  const now = new Date()
  const professional: Professional = {
    name: ctx.user.name,
    registry: ctx.user.professionalRegistry,
    taxId: ctx.user.taxId,
    address: ctx.user.address,
  }
  const patient = { name: contact.name, document: contact.document }
  const issued = {
    issuedOn: formatInTz(now, tz, "d 'de' MMMM 'de' yyyy"),
    issuedAtLabel: formatInTz(now, tz, "dd/MM/yyyy 'às' HH:mm"),
  }

  const first = bookings[0]
  const payload: DocumentPayload = (() => {
    switch (data.kind) {
      case "receipt":
        return {
          kind: "receipt",
          professional,
          patient,
          items: bookings.map((b) => ({
            date: formatInTz(b.startsAt, tz, "dd/MM/yyyy"),
            description: b.eventType.title,
          })),
          totalCents: data.totalCents,
          paymentMethod: data.paymentMethod || null,
          ...issued,
        }
      case "attendance":
        return {
          kind: "attendance",
          professional,
          patient,
          date: formatInTz(first.startsAt, tz, "dd/MM/yyyy"),
          start: formatInTz(first.startsAt, tz, "HH:mm"),
          end: formatInTz(first.endsAt, tz, "HH:mm"),
          description: ctx.vocab.appointment,
          ...issued,
        }
      case "certificate":
        return {
          kind: "certificate",
          professional,
          patient,
          date: formatInTz(first.startsAt, tz, "dd/MM/yyyy"),
          start: formatInTz(first.startsAt, tz, "HH:mm"),
          end: formatInTz(first.endsAt, tz, "HH:mm"),
          days: data.days,
          cid: data.cid || null,
          ...issued,
        }
      case "prescription":
        return {
          kind: "prescription",
          professional,
          patient,
          usage: data.usage,
          items: data.items,
          notes: data.notes || null,
          ...issued,
        }
    }
  })()

  const doc = await db.transaction(async (tx) => {
    // Numeração sequencial sem buracos nem repetição, mesmo com emissões simultâneas.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`doc:${ctx.org.id}`}))`)
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${schema.issuedDocument.number}), 0) + 1` })
      .from(schema.issuedDocument)
      .where(eq(schema.issuedDocument.organizationId, ctx.org.id))
    const [row] = await tx
      .insert(schema.issuedDocument)
      .values({
        organizationId: ctx.org.id,
        contactId: contact.id,
        issuedById: ctx.user.id,
        kind: data.kind,
        number: Number(next),
        payload,
      })
      .returning({ id: schema.issuedDocument.id, number: schema.issuedDocument.number })
    return row
  })

  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: contact.id,
    action: "document_issued",
    targetId: doc.id,
  })
  revalidatePath(`/app/contacts/${contact.id}`)
  return { ok: true as const, id: doc.id, number: doc.number }
}
