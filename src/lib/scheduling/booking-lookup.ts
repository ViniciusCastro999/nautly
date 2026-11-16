import "server-only"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/db"

export async function findBookingByToken(token: string) {
  return db.query.booking.findFirst({
    where: eq(schema.booking.manageToken, token),
    with: { eventType: true, contact: true, host: true },
  })
}

/** Anamnese ainda não preenchida do paciente, para oferecer o link na confirmação. */
export async function findPendingAnamnesis(contactId: string) {
  return db.query.anamnesis.findFirst({
    where: and(eq(schema.anamnesis.contactId, contactId), eq(schema.anamnesis.status, "pending")),
    columns: { token: true },
  })
}
