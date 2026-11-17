import type { Metadata } from "next"
import Link from "next/link"
import { and, eq, ilike, or, sql } from "drizzle-orm"
import { ChevronRightIcon, PlusIcon, SearchIcon, UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { ContactFormDialog } from "@/components/app/contacts/contact-form-dialog"
import { db, schema } from "@/db"
import { formatInTz, initials } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const { vocab } = await requireWorkspace()
  return { title: vocab.clients }
}

/** Sem atendimento há mais que isso (e sem próximo horário) = inativo. */
const INACTIVE_DAYS = 60

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "inactive", label: "Inativos" },
] as const
type FilterKey = (typeof FILTERS)[number]["key"]

export default async function ContactsPage({ searchParams }: PageProps<"/app/contacts">) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim() : ""
  const filter: FilterKey = FILTERS.some((f) => f.key === params.filter)
    ? (params.filter as FilterKey)
    : "all"

  const { user, org, vocab, can } = await requireWorkspace()
  const { contact, booking } = schema
  const confirmedJoin = and(eq(booking.contactId, contact.id), eq(booking.status, "confirmed"))

  const rows = await db
    .select({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      lastAt: sql<Date | null>`max(${booking.startsAt}) filter (where ${booking.startsAt} <= now())`,
      nextAt: sql<Date | null>`min(${booking.startsAt}) filter (where ${booking.startsAt} > now())`,
    })
    .from(contact)
    .leftJoin(booking, confirmedJoin)
    .where(
      and(
        eq(contact.organizationId, org.id),
        q
          ? or(ilike(contact.name, `%${q}%`), ilike(contact.email, `%${q}%`), ilike(contact.phone, `%${q}%`))
          : undefined,
      ),
    )
    .groupBy(contact.id)
    .orderBy(sql`max(${booking.startsAt}) desc nulls last`, contact.name)

  const cutoff = new Date().getTime() - INACTIVE_DAYS * 864e5
  const withStatus = rows.map((c) => {
    const last = c.lastAt ? new Date(c.lastAt).getTime() : null
    const active = Boolean(c.nextAt) || (last !== null && last >= cutoff)
    return { ...c, active }
  })
  const activeCount = withStatus.filter((c) => c.active).length
  const inactiveCount = withStatus.length - activeCount
  const needReturn = withStatus.filter((c) => c.lastAt && !c.nextAt).length
  const visible = withStatus.filter((c) =>
    filter === "all" ? true : filter === "active" ? c.active : !c.active,
  )

  const href = (next: Partial<{ q: string; filter: FilterKey }>) => {
    const sp = new URLSearchParams()
    const nq = next.q ?? q
    const nf = next.filter ?? filter
    if (nq) sp.set("q", nq)
    if (nf !== "all") sp.set("filter", nf)
    const s = sp.toString()
    return s ? `/app/contacts?${s}` : "/app/contacts"
  }

  return (
    <>
      <PageHeader
        title={vocab.clients}
        description={`Acompanhe quem está em atendimento e quem precisa ser reativado.`}
        actions={
          can("clients:write") && (
            <ContactFormDialog clientNoun={vocab.client}>
              <Button size="lg">
                <PlusIcon /> Novo {vocab.client}
              </Button>
            </ContactFormDialog>
          )
        }
      />

      <div className="mb-[17px] grid gap-[13px] sm:grid-cols-3">
        <SummaryCard
          href={href({ filter: "active" })}
          selected={filter === "active"}
          label={`${vocab.clients} ativos`}
          hint={`Com horário marcado ou atendidos nos últimos ${INACTIVE_DAYS} dias`}
          value={activeCount}
        />
        <SummaryCard
          href={href({ filter: "inactive" })}
          selected={filter === "inactive"}
          label={`${vocab.clients} inativos`}
          hint={`Sem atendimento há mais de ${INACTIVE_DAYS} dias`}
          value={inactiveCount}
        />
        <SummaryCard label="Precisam de retorno" hint="Sem próximo horário marcado" value={needReturn} />
      </div>

      <section className="overflow-hidden rounded-[13px] border bg-card">
        <div className="flex flex-col gap-3 border-b p-[15px] sm:flex-row sm:items-center sm:justify-between">
          <form
            action="/app/contacts"
            className="flex h-[39px] w-full items-center gap-2.5 rounded-[9px] border bg-muted px-3 text-muted-foreground focus-within:border-ring focus-within:bg-card sm:max-w-[290px]"
          >
            <SearchIcon className="size-4 shrink-0" />
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder={`Buscar ${vocab.client}...`}
              aria-label={`Buscar ${vocab.client}`}
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </form>
          <div className="inline-flex w-fit rounded-[10px] border bg-card p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href({ filter: f.key })}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  filter === f.key
                    ? "bg-sea-50 text-primary dark:text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <span className="mb-3 grid size-11 place-items-center rounded-[10px] bg-sea-50 text-sea">
              <UsersIcon className="size-5" />
            </span>
            <p className="font-semibold">
              {q ? `Nenhum ${vocab.client} encontrado para “${q}”` : `Nenhum ${vocab.client} por aqui`}
            </p>
            {q && (
              <Link href={href({ q: "" })} className="mt-2 text-sm font-semibold text-primary dark:text-foam">
                Limpar busca
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="px-[19px] py-3 font-semibold">{vocab.client}</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Status</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Último atendimento</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Próximo passo</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} className="group relative border-t border-line-soft hover:bg-muted">
                    <td className="px-[19px] py-3">
                      <Link
                        href={`/app/contacts/${c.id}`}
                        className="flex items-center gap-3 after:absolute after:inset-0"
                      >
                        <Avatar className="size-[34px]">
                          <AvatarFallback className="bg-foam/50 text-[13px] font-semibold text-primary dark:bg-sea-50 dark:text-foam">
                            {initials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{c.name}</p>
                          <p className="truncate text-[13px] text-muted-foreground">
                            {c.email ?? c.phone ?? "Sem contato"}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Badge variant={c.active ? "success" : "muted"}>
                        <i className="size-1.5 rounded-full bg-current" /> {c.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {c.lastAt ? formatInTz(c.lastAt, user.timezone, "d MMM yyyy") : "-"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {c.nextAt ? (
                        formatInTz(c.nextAt, user.timezone, "d MMM, HH:mm")
                      ) : (
                        <span className="text-muted-foreground">Sem horário marcado</span>
                      )}
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
      </section>
    </>
  )
}

function SummaryCard({
  label,
  hint,
  value,
  href,
  selected,
}: {
  label: string
  hint: string
  value: number
  href?: string
  selected?: boolean
}) {
  const body = (
    <>
      <div className="grid min-w-0 gap-1">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <small className="text-xs text-muted-foreground/80">{hint}</small>
      </div>
      <strong className="text-[28px] leading-none font-bold text-primary dark:text-foreground">
        {value}
      </strong>
    </>
  )
  const cls = cn(
    "relative flex items-center justify-between gap-4 overflow-hidden rounded-[13px] border bg-card p-[18px] transition-colors",
    selected && "border-sea before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-sea",
  )
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-sea")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
