import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { addMonths, format, parse } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, WalletIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { DeletePaymentButton } from "@/components/app/finance/delete-payment-button"
import { PaymentDialog, type UnpaidBooking } from "@/components/app/finance/payment-dialog"
import { db, schema } from "@/db"
import { formatBRL } from "@/lib/documents/money"
import { financePeriod, monthRange, PAYMENT_METHOD_LABELS } from "@/lib/finance"
import { formatInTz, initials } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Financeiro" }

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export default async function FinancePage({ searchParams }: PageProps<"/app/finance">) {
  const { org, user, vocab, can } = await requireWorkspace()
  if (!can("finance:manage")) redirect("/app")
  const tz = user.timezone
  const now = new Date()
  const currentKey = formatInTz(now, tz, "yyyy-MM")
  const todayKey = formatInTz(now, tz, "yyyy-MM-dd")

  const params = await searchParams
  const monthKey = typeof params.month === "string" && MONTH_RE.test(params.month) ? params.month : currentKey
  const monthDate = parse(monthKey, "yyyy-MM", new Date())
  const shift = (n: number) => format(addMonths(monthDate, n), "yyyy-MM")
  const range = monthRange(monthKey, tz)

  // Opções do formulário: atendimentos sem pagamento dos últimos 6 meses até 2 meses à frente.
  const optionsRange = { start: monthRange(shift(-6), tz).start, end: monthRange(shift(3), tz).start }
  const [{ payments, unpaid }, options, contacts] = await Promise.all([
    financePeriod(org.id, range),
    financePeriod(org.id, optionsRange),
    db
      .select({ id: schema.contact.id, name: schema.contact.name })
      .from(schema.contact)
      .where(eq(schema.contact.organizationId, org.id))
      .orderBy(asc(schema.contact.name)),
  ])

  const unpaidOptions: UnpaidBooking[] = options.unpaid.map((b) => ({
    id: b.id,
    contactId: b.contactId,
    label: `${formatInTz(b.startsAt, tz, "dd/MM HH:mm")} · ${b.service} · ${formatBRL(b.priceCents)}`,
    priceCents: b.priceCents,
  }))

  const received = payments.reduce((s, p) => s + p.amountCents, 0)
  const overdue = unpaid.filter((b) => b.startsAt < now)
  const upcoming = unpaid.filter((b) => b.startsAt >= now)
  const sum = (list: { priceCents: number }[]) => list.reduce((s, b) => s + b.priceCents, 0)

  type Row = {
    key: string
    at: Date
    name: string
    detail: string
    amount: number
    state: "paid" | "overdue" | "upcoming"
    paymentId?: string
    booking?: { id: string; contactId: string }
  }
  const rows: Row[] = [
    ...payments.map((p) => ({
      key: `p-${p.id}`,
      at: p.paidAt,
      name: p.contact.name,
      detail: [
        p.booking?.eventType.title ?? p.description ?? "Pagamento avulso",
        PAYMENT_METHOD_LABELS[p.method],
      ]
        .filter(Boolean)
        .join(" · "),
      amount: p.amountCents,
      state: "paid" as const,
      paymentId: p.id,
    })),
    ...unpaid.map((b) => ({
      key: `b-${b.id}`,
      at: b.startsAt,
      name: b.contactName,
      detail: b.service,
      amount: b.priceCents,
      state: b.startsAt < now ? ("overdue" as const) : ("upcoming" as const),
      booking: { id: b.id, contactId: b.contactId },
    })),
  ].sort((a, b) => {
    const order = { overdue: 0, paid: 1, upcoming: 2 }
    return order[a.state] - order[b.state] || (a.state === "upcoming" ? +a.at - +b.at : +b.at - +a.at)
  })

  const monthLabel = formatInTz(
    range.start,
    tz,
    monthKey.slice(0, 4) === currentKey.slice(0, 4) ? "MMMM" : "MMMM yyyy",
  )
  const dialogProps = { clientNoun: vocab.client, contacts, unpaid: unpaidOptions, today: todayKey }

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        description="Acompanhe recebimentos e pendências do mês."
        actions={
          <>
            <div className="inline-flex rounded-[8px] border bg-card">
              <Button asChild variant="ghost" size="icon" aria-label="Mês anterior">
                <Link href={`/app/finance?month=${shift(-1)}`}>
                  <ChevronLeftIcon />
                </Link>
              </Button>
              {monthKey !== currentKey && (
                <Button asChild variant="ghost" className="border-x px-3 text-[13px]">
                  <Link href="/app/finance">Mês atual</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon" aria-label="Próximo mês">
                <Link href={`/app/finance?month=${shift(1)}`}>
                  <ChevronRightIcon />
                </Link>
              </Button>
            </div>
            <PaymentDialog {...dialogProps}>
              <Button size="lg">
                <PlusIcon /> Registrar pagamento
              </Button>
            </PaymentDialog>
          </>
        }
      />

      <div className="mb-[17px] grid gap-[13px] sm:grid-cols-3">
        <Metric label="Recebido" value={formatBRL(received)} hint={plural(payments.length, "pagamento")} />
        <Metric
          label="A receber"
          value={formatBRL(sum(upcoming))}
          hint={plural(upcoming.length, vocab.appointment.toLowerCase(), vocab.appointments.toLowerCase())}
        />
        <Metric
          label="Em atraso"
          value={formatBRL(sum(overdue))}
          hint={plural(overdue.length, "pagamento")}
          tone={overdue.length > 0 ? "warm" : undefined}
        />
      </div>

      <section className="overflow-hidden rounded-[13px] border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-[19px] py-4">
          <h2 className="font-semibold text-primary dark:text-foreground">Movimentações do mês</h2>
          <p className="text-[13px] text-muted-foreground">{plural(rows.length, "lançamento")}</p>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <span className="mb-3 grid size-11 place-items-center rounded-[10px] bg-sea-50 text-sea">
              <WalletIcon className="size-5" />
            </span>
            <p className="font-semibold">Nada neste mês</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Pagamentos registrados e {vocab.appointments.toLowerCase()} com valor aparecem aqui. Defina o
              valor de cada serviço em Serviços.
            </p>
          </div>
        ) : (
          <ul>
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center gap-3 border-t border-line-soft px-[19px] py-3 first:border-t-0"
              >
                <Avatar className="size-[34px]">
                  <AvatarFallback className="bg-foam/50 text-[13px] font-semibold text-primary dark:bg-sea-50 dark:text-foam">
                    {initials(r.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {r.detail} · {formatInTz(r.at, tz, "d MMM")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  {r.state === "paid" ? (
                    <Badge variant="success" className="hidden sm:inline-flex">
                      Recebido
                    </Badge>
                  ) : r.state === "overdue" ? (
                    <Badge variant="warm" className="hidden sm:inline-flex">
                      Em atraso
                    </Badge>
                  ) : (
                    <Badge variant="muted" className="hidden sm:inline-flex">
                      A receber
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "w-24 text-right text-sm font-semibold tabular-nums",
                      r.state === "overdue" && "text-warm-foreground",
                      r.state === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {formatBRL(r.amount)}
                  </span>
                  {r.paymentId ? (
                    <DeletePaymentButton
                      id={r.paymentId}
                      label={`${formatBRL(r.amount)} de ${r.name} em ${formatInTz(r.at, tz, "dd/MM/yyyy")}`}
                    />
                  ) : (
                    r.booking && (
                      <PaymentDialog
                        {...dialogProps}
                        unpaid={[
                          ...unpaidOptions.filter((o) => o.id !== r.booking!.id),
                          {
                            id: r.booking.id,
                            contactId: r.booking.contactId,
                            label: `${formatInTz(r.at, tz, "dd/MM HH:mm")} · ${r.detail} · ${formatBRL(r.amount)}`,
                            priceCents: r.amount,
                          },
                        ]}
                        initial={{ contactId: r.booking.contactId, bookingId: r.booking.id }}
                      >
                        <Button variant="outline" size="sm">
                          Receber
                        </Button>
                      </PaymentDialog>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "warm" }) {
  return (
    <div className="grid gap-1.5 rounded-[13px] border bg-card p-[18px]">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <strong
        className={cn(
          "text-[24px] leading-tight font-bold text-primary tabular-nums dark:text-foreground",
          tone === "warm" && "text-warm-foreground dark:text-warm",
        )}
      >
        {value}
      </strong>
      <small className="text-xs text-muted-foreground">{hint}</small>
    </div>
  )
}
