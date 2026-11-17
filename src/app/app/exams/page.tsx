import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { and, asc, count, eq, ilike, isNull, max, sql } from "drizzle-orm"
import { differenceInYears, parseISO } from "date-fns"
import { ChevronRightIcon, FileTextIcon, InfoIcon, SearchIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/app/page-header"
import { AddExamDialog } from "@/components/app/exams/add-exam-dialog"
import { db, schema } from "@/db"
import { formatInTz, initials } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Exames" }

export default async function ExamsPage({ searchParams }: PageProps<"/app/exams">) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim() : ""
  const { org, user, vocab, can, canUseModule } = await requireWorkspace()
  if (!canUseModule("attachments")) redirect("/app")

  const { attachment, contact } = schema
  const rows = await db
    .select({
      id: contact.id,
      name: contact.name,
      birthDate: contact.birthDate,
      total: count(attachment.id),
      toReview: sql<number>`count(*) filter (where ${attachment.reviewedAt} is null)`.mapWith(Number),
      lastAt: max(attachment.createdAt),
    })
    .from(attachment)
    .innerJoin(contact, eq(contact.id, attachment.contactId))
    .where(
      and(
        eq(attachment.organizationId, org.id),
        eq(attachment.category, "exam"),
        q ? ilike(contact.name, `%${q}%`) : undefined,
      ),
    )
    .groupBy(contact.id)
    .orderBy(
      sql`count(*) filter (where ${attachment.reviewedAt} is null) desc`,
      sql`max(${attachment.createdAt}) desc`,
    )

  const pendingTotal = (
    await db
      .select({ n: count() })
      .from(attachment)
      .where(
        and(
          eq(attachment.organizationId, org.id),
          eq(attachment.category, "exam"),
          isNull(attachment.reviewedAt),
        ),
      )
  )[0].n

  const contacts = can("clinical:write")
    ? await db
        .select({ id: contact.id, name: contact.name })
        .from(contact)
        .where(eq(contact.organizationId, org.id))
        .orderBy(asc(contact.name))
    : []

  const now = new Date()
  const client = vocab.client.toLowerCase()

  return (
    <>
      <PageHeader
        eyebrow="Exames"
        title={`Exames por ${client}`}
        description="Cada laudo fica dentro do histórico clínico da pessoa certa."
        actions={can("clinical:write") && <AddExamDialog clientNoun={vocab.client} contacts={contacts} />}
      />

      <div className="mb-[17px] flex items-start gap-2.5 rounded-[13px] border border-sea/30 bg-sea-50 px-4 py-3 text-[13px] text-primary dark:text-foreground">
        <InfoIcon className="mt-px size-4 shrink-0 text-sea" />
        <p>
          Nenhum exame fica solto. Escolha o {client} antes de abrir, revisar ou adicionar um laudo.
          {pendingTotal > 0 && (
            <strong className="font-semibold">
              {" "}
              {pendingTotal} {pendingTotal === 1 ? "exame aguarda" : "exames aguardam"} revisão.
            </strong>
          )}
        </p>
      </div>

      <section className="overflow-hidden rounded-[13px] border bg-card">
        <div className="flex flex-col gap-3 border-b p-[15px] sm:flex-row sm:items-center sm:justify-between">
          <form
            action="/app/exams"
            className="flex h-[39px] w-full items-center gap-2.5 rounded-[9px] border bg-muted px-3 text-muted-foreground focus-within:border-ring focus-within:bg-card sm:max-w-[290px]"
          >
            <SearchIcon className="size-4 shrink-0" />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder={`Buscar ${client}...`}
              aria-label={`Buscar ${client}`}
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </form>
          <p className="text-[13px] text-muted-foreground">
            {rows.length}{" "}
            {rows.length === 1 ? `${client} com exames` : `${vocab.clients.toLowerCase()} com exames`}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <span className="mb-3 grid size-11 place-items-center rounded-[10px] bg-sea-50 text-sea">
              <FileTextIcon className="size-5" />
            </span>
            <p className="font-semibold">
              {q ? `Nenhum exame encontrado para “${q}”` : "Nenhum exame ainda"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {q ? (
                <Link href="/app/exams" className="font-semibold text-primary dark:text-foam">
                  Limpar busca
                </Link>
              ) : (
                `Os exames anexados na ficha de cada ${client} aparecem aqui.`
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="px-[19px] py-3 font-semibold">{vocab.client}</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Laudos</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Último exame</th>
                  <th className="px-4 py-3 font-semibold">Situação</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const age = r.birthDate ? differenceInYears(now, parseISO(r.birthDate)) : null
                  return (
                    <tr key={r.id} className="group relative border-t border-line-soft hover:bg-muted">
                      <td className="px-[19px] py-3">
                        <Link
                          href={`/app/contacts/${r.id}?tab=attachments`}
                          className="flex items-center gap-3 after:absolute after:inset-0"
                        >
                          <Avatar className="size-[34px]">
                            <AvatarFallback className="bg-foam/50 text-[13px] font-semibold text-primary dark:bg-sea-50 dark:text-foam">
                              {initials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{r.name}</p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {age !== null ? `${age} anos` : "Idade não informada"}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {r.total} {r.total === 1 ? "laudo" : "laudos"}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {r.lastAt ? formatInTz(r.lastAt, user.timezone, "dd MMM yyyy") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {r.toReview > 0 ? (
                          <Badge variant="warm">{r.toReview} para revisar</Badge>
                        ) : (
                          <Badge variant="success">Tudo revisado</Badge>
                        )}
                      </td>
                      <td className="pr-4 text-muted-foreground">
                        <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
