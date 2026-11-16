import type { Metadata } from "next"
import Link from "next/link"
import { eq, sql } from "drizzle-orm"
import { ChevronRightIcon, PlusIcon, UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { ContactFormDialog } from "@/components/app/contacts/contact-form-dialog"
import { db, schema } from "@/db"
import { formatInTz, initials } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const { vocab } = await requireWorkspace()
  return { title: vocab.clients }
}

export default async function ContactsPage() {
  const { user, org, vocab, can } = await requireWorkspace()
  const { contact, booking } = schema

  const rows = await db
    .select({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      total: sql<number>`count(${booking.id}) filter (where ${booking.status} = 'confirmed')::int`,
      lastAt: sql<Date | null>`max(${booking.startsAt})`,
    })
    .from(contact)
    .leftJoin(booking, eq(booking.contactId, contact.id))
    .where(eq(contact.organizationId, org.id))
    .groupBy(contact.id)
    .orderBy(sql`max(${booking.startsAt}) desc nulls last`, contact.name)

  return (
    <>
      <PageHeader
        title={vocab.clients}
        description={`Todos os ${vocab.clients.toLowerCase()} que já agendaram ou foram cadastrados por você.`}
        actions={
          can("clients:write") && (
            <ContactFormDialog clientNoun={vocab.client}>
              <Button className="h-10 rounded-full px-5">
                <PlusIcon /> Novo {vocab.client}
              </Button>
            </ContactFormDialog>
          )
        }
      />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <UsersIcon className="mb-3 size-10 text-muted-foreground" />
          <p className="font-semibold">Nenhum {vocab.client} ainda</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Telefone</th>
                <th className="px-5 py-3 text-right font-semibold">{vocab.appointments}</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Último</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id} className="group relative hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link
                      href={`/app/contacts/${c.id}`}
                      className="flex items-center gap-3 after:absolute after:inset-0"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {initials(c.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="truncate text-muted-foreground">{c.email ?? "Sem e-mail"}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 md:table-cell">{c.phone ?? "-"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.total}</td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    {c.lastAt ? formatInTz(c.lastAt, user.timezone, "dd/MM/yyyy") : "-"}
                  </td>
                  <td className="pr-4 text-muted-foreground">
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
