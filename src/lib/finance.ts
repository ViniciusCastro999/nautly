import "server-only"
import { TZDate } from "@date-fns/tz"
import { and, eq, gte, isNotNull, isNull, lt, ne, or } from "drizzle-orm"
import { db, schema } from "@/db"

export const PAYMENT_METHOD_LABELS: Record<(typeof schema.paymentMethod.enumValues)[number], string> = {
  pix: "Pix",
  card: "Cartão",
  cash: "Dinheiro",
  transfer: "Transferência",
  other: "Outro",
}

/** "2026-11" → início e fim do mês no fuso informado. */
export function monthRange(monthKey: string, tz: string) {
  const [y, m] = monthKey.split("-").map(Number)
  return {
    start: new Date(new TZDate(y, m - 1, 1, tz).getTime()),
    end: new Date(new TZDate(y, m, 1, tz).getTime()),
  }
}

/**
 * Pagamentos recebidos no período e atendimentos com valor ainda sem pagamento.
 * Faltas e cancelamentos não entram como valor a receber.
 */
export async function financePeriod(orgId: string, range: { start: Date; end: Date }) {
  const { booking, contact, eventType, payment } = schema

  const [payments, unpaid] = await Promise.all([
    db.query.payment.findMany({
      where: and(
        eq(payment.organizationId, orgId),
        gte(payment.paidAt, range.start),
        lt(payment.paidAt, range.end),
      ),
      with: { contact: true, booking: { with: { eventType: true } } },
      orderBy: (p, { desc }) => [desc(p.paidAt), desc(p.createdAt)],
    }),
    db
      .select({
        id: booking.id,
        startsAt: booking.startsAt,
        contactId: contact.id,
        contactName: contact.name,
        service: eventType.title,
        priceCents: eventType.priceCents,
      })
      .from(booking)
      .innerJoin(eventType, eq(eventType.id, booking.eventTypeId))
      .innerJoin(contact, eq(contact.id, booking.contactId))
      .leftJoin(payment, eq(payment.bookingId, booking.id))
      .where(
        and(
          eq(booking.organizationId, orgId),
          eq(booking.status, "confirmed"),
          or(isNull(booking.attendance), ne(booking.attendance, "no_show")),
          isNotNull(eventType.priceCents),
          isNull(payment.id),
          gte(booking.startsAt, range.start),
          lt(booking.startsAt, range.end),
        ),
      )
      .orderBy(booking.startsAt),
  ])

  return {
    payments,
    unpaid: unpaid.map((b) => ({ ...b, priceCents: b.priceCents ?? 0 })),
  }
}
