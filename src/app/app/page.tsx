import type { Metadata } from "next"
import Link from "next/link"
import { TZDate } from "@date-fns/tz"
import { and, asc, count, eq, gt, gte, isNull, lt, sql } from "drizzle-orm"
import {
  CalendarCheck2Icon,
  CalendarPlusIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  Clock3Icon,
  LinkIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { LocationPill } from "@/components/app/booking-row"
import { NewBookingDialog } from "@/components/app/new-booking-dialog"
import { db, schema } from "@/db"
import { calendarRange } from "@/lib/calendar"
import { APP_DOMAIN } from "@/lib/constants"
import { formatBRL } from "@/lib/documents/money"
import { formatInTz, initials } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Início" }

function greeting(hour: number) {
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

export default async function HomePage() {
  const ctx = await requireWorkspace()
  const { user, org, vocab } = ctx
  const tz = user.timezone
  const { booking, contact, eventType } = schema
  const now = new Date()
  const today = calendarRange("day", undefined, tz)
  const week = { start: today.start, end: new Date(today.start.getTime() + 7 * 864e5) }
  const [y, m] = today.monthKey.split("-").map(Number)
  const month = {
    start: new Date(new TZDate(y, m - 1, 1, tz).getTime()),
    end: new Date(new TZDate(y, m, 1, tz).getTime()),
  }
  const confirmed = and(eq(booking.organizationId, org.id), eq(booking.status, "confirmed"))

  const [todayList, [clients], [newClients], [weekCount], [pending], [revenue], next, contacts, eventTypes] =
    await Promise.all([
      db.query.booking.findMany({
        where: and(confirmed, gte(booking.startsAt, today.start), lt(booking.startsAt, today.end)),
        with: { contact: true, eventType: true },
        orderBy: [asc(booking.startsAt)],
      }),
      db.select({ n: count() }).from(contact).where(eq(contact.organizationId, org.id)),
      db
        .select({ n: count() })
        .from(contact)
        .where(and(eq(contact.organizationId, org.id), gte(contact.createdAt, month.start))),
      db
        .select({ n: count() })
        .from(booking)
        .where(and(confirmed, gte(booking.startsAt, week.start), lt(booking.startsAt, week.end))),
      db
        .select({ n: count() })
        .from(booking)
        .where(and(confirmed, lt(booking.endsAt, now), isNull(booking.attendance))),
      db
        .select({ cents: sql<number>`coalesce(sum(${eventType.priceCents}), 0)::int` })
        .from(booking)
        .innerJoin(eventType, eq(eventType.id, booking.eventTypeId))
        .where(and(confirmed, gte(booking.startsAt, month.start), lt(booking.startsAt, month.end))),
      db.query.booking.findFirst({
        where: and(confirmed, gt(booking.endsAt, now)),
        with: { contact: true, eventType: true },
        orderBy: [asc(booking.startsAt)],
      }),
      ctx.can("agenda:manage")
        ? db.query.contact.findMany({
            where: eq(contact.organizationId, org.id),
            columns: { id: true, name: true },
            orderBy: [asc(contact.name)],
          })
        : [],
      ctx.can("agenda:manage")
        ? db.query.eventType.findMany({
            where: and(eq(eventType.organizationId, org.id), eq(eventType.hostId, user.id)),
            columns: { id: true, title: true, durationMinutes: true, color: true },
            orderBy: [asc(eventType.createdAt)],
          })
        : [],
    ])

  const done = todayList.filter((b) => b.endsAt < now).length
  const upcomingToday = todayList.find((b) => b.endsAt > now)
  const apptLower = vocab.appointments.toLowerCase()
  const firstName = user.name.split(/\s+/).find((p) => !/^(dra?|sra?)\.?$/i.test(p)) ?? user.name
  const hour = Number(formatInTz(now, tz, "H"))
  const monthName = formatInTz(now, tz, "MMMM")

  const subtitle =
    todayList.length === 0
      ? "Nenhum horário marcado para hoje. Bom momento para organizar a semana."
      : `Você tem ${todayList.length} ${todayList.length === 1 ? vocab.appointment.toLowerCase() : apptLower} hoje.` +
        (upcomingToday ? ` A próxima começa às ${formatInTz(upcomingToday.startsAt, tz, "HH:mm")}.` : "")

  return (
    <>
      <PageHeader
        eyebrow={formatInTz(now, tz, "EEEE, d 'de' MMMM")}
        title={`${greeting(hour)}, ${firstName}.`}
        description={subtitle}
        actions={
          ctx.can("agenda:manage") && (
            <NewBookingDialog
              contacts={contacts}
              eventTypes={eventTypes}
              recurringEnabled={ctx.hasModule("recurring")}
              defaultDate={today.todayKey}
              clientNoun={vocab.client}
            >
              <Button size="lg">
                <CalendarPlusIcon /> Novo agendamento
              </Button>
            </NewBookingDialog>
          )
        }
      />

      <div className="mb-[17px] grid grid-cols-2 gap-[13px] xl:grid-cols-4">
        <Metric
          accent
          icon={CalendarCheck2Icon}
          label={`${vocab.appointments} hoje`}
          value={todayList.length}
          foot={
            <>
              <b>{done}</b> concluíd{done === 1 ? "o" : "os"}
            </>
          }
        />
        <Metric
          icon={UsersIcon}
          label={`${vocab.clients} cadastrados`}
          value={clients.n}
          foot={
            <>
              <b>+{newClients.n}</b> este mês
            </>
          }
        />
        <Metric
          icon={Clock3Icon}
          label="Próximos 7 dias"
          value={weekCount.n}
          foot={`${vocab.appointments} confirmados`}
        />
        <Metric
          icon={WalletIcon}
          label={`Previsto em ${monthName}`}
          value={formatBRL(revenue.cents)}
          currency
          foot="Pelo valor de cada serviço"
        />
      </div>

      <div className="grid gap-[17px] xl:grid-cols-[minmax(0,1.62fr)_minmax(300px,0.88fr)]">
        <section className="rounded-[13px] border bg-card">
          <CardHead
            title="Agenda de hoje"
            subtitle={formatInTz(now, tz, "EEEE, d 'de' MMMM")}
            action={
              <Link
                href="/app/bookings"
                className="flex items-center gap-0.5 text-[13px] font-semibold text-primary dark:text-foam"
              >
                Ver agenda <ChevronRightIcon className="size-4" />
              </Link>
            }
          />
          {todayList.length === 0 ? (
            <div className="grid place-items-center px-6 py-14 text-center">
              <span className="mb-3 grid size-11 place-items-center rounded-[10px] bg-sea-50 text-sea">
                <CalendarCheck2Icon className="size-5" />
              </span>
              <p className="font-semibold">Dia livre por aqui</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Compartilhe seu link para que seus {vocab.clients.toLowerCase()} marquem um horário.
              </p>
            </div>
          ) : (
            <ul>
              {todayList.map((b) => {
                const isNext = b.id === upcomingToday?.id
                const past = b.endsAt < now
                return (
                  <li
                    key={b.id}
                    className={cn(
                      "relative grid min-h-[72px] grid-cols-[45px_12px_34px_minmax(0,1fr)_auto] items-center gap-2.5 px-[15px] py-[7px] sm:grid-cols-[45px_12px_41px_minmax(0,1fr)_auto]",
                      "border-line-soft not-first:border-t",
                      isNext && "bg-sea-50 shadow-[inset_3px_0_var(--sea)]",
                    )}
                  >
                    <time className="text-center text-[13px] font-semibold text-muted-foreground tabular-nums">
                      {formatInTz(b.startsAt, tz, "HH:mm")}
                    </time>
                    <span className="relative flex h-full justify-center before:h-full before:w-px before:bg-border">
                      <i
                        className={cn(
                          "absolute top-[calc(50%-5px)] box-content size-[7px] rounded-full border-2 border-card",
                          isNext ? "bg-sea" : "bg-input",
                        )}
                      />
                    </span>
                    <Avatar className="size-[34px] sm:size-[41px]">
                      <AvatarFallback className="bg-foam/50 text-xs font-semibold text-primary dark:bg-sea-50 dark:text-foam">
                        {initials(b.contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <Link href={`/app/contacts/${b.contactId}`} className="grid min-w-0 gap-1">
                      <strong className="truncate text-sm font-semibold">{b.contact.name}</strong>
                      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                        <span className="truncate">{b.eventType.title}</span>
                        <i className="hidden size-[3px] shrink-0 rounded-full bg-input sm:block" />
                        <span className="hidden sm:block">
                          <LocationPill type={b.eventType.locationType} />
                        </span>
                      </span>
                    </Link>
                    {b.attendance === "no_show" ? (
                      <Badge variant="warm">Faltou</Badge>
                    ) : past || b.attendance === "attended" ? (
                      <Badge variant="muted">Concluída</Badge>
                    ) : isNext ? (
                      <Button asChild size="sm">
                        <Link href={`/app/contacts/${b.contactId}`}>Abrir ficha</Link>
                      </Button>
                    ) : (
                      <Badge variant="success">Confirmado</Badge>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-[17px]">
          <section className="rounded-[13px] border bg-card p-[19px]">
            <p className="eyebrow mb-4">Próximo atendimento</p>
            {next ? (
              <>
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-[41px]">
                    <AvatarFallback className="bg-foam/50 text-xs font-semibold text-primary dark:bg-sea-50 dark:text-foam">
                      {initials(next.contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-bold">{next.contact.name}</h3>
                    <span className="text-[13px] text-muted-foreground">{next.eventType.title}</span>
                  </div>
                  <b className="text-right text-[19px] font-bold text-primary dark:text-foreground">
                    {formatInTz(next.startsAt, tz, "HH:mm")}
                    <span className="block text-xs font-semibold text-muted-foreground first-letter:uppercase">
                      {formatInTz(next.startsAt, tz, "EEE, d MMM")}
                    </span>
                  </b>
                </div>
                <div className="my-[15px] flex flex-wrap gap-[5px]">
                  <span className="rounded-[5px] bg-sea-50 px-2 py-[5px] text-xs text-accent-foreground">
                    {next.eventType.durationMinutes} min
                  </span>
                  <LocationPill type={next.eventType.locationType} />
                  {next.contact.phone && (
                    <span className="rounded-[5px] bg-sea-50 px-2 py-[5px] text-xs text-accent-foreground">
                      {next.contact.phone}
                    </span>
                  )}
                </div>
                {next.notes && (
                  <div className="mb-[13px] rounded-[8px] border border-line-soft bg-muted p-3">
                    <span className="text-xs font-semibold tracking-wide text-sea uppercase">
                      Observação do agendamento
                    </span>
                    <p className="mt-[5px] text-[13px] leading-relaxed text-muted-foreground">{next.notes}</p>
                  </div>
                )}
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/app/contacts/${next.contactId}`}>
                    Ver ficha <ChevronRightIcon />
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum horário marcado por enquanto.</p>
            )}
          </section>

          <section className="rounded-[13px] border bg-card">
            <CardHead
              title="Pendências"
              subtitle={pending.n > 0 ? "Itens que precisam da sua atenção" : "Tudo em dia"}
              action={
                pending.n > 0 && (
                  <span className="grid size-[23px] place-items-center rounded-full bg-warm-50 text-[13px] text-warm-foreground">
                    {pending.n}
                  </span>
                )
              }
            />
            <PendingLink
              href="/app/bookings?tab=past"
              icon={ClipboardCheckIcon}
              tone="warm"
              title={
                pending.n > 0
                  ? `${pending.n} ${pending.n === 1 ? "presença" : "presenças"} para marcar`
                  : "Presenças marcadas"
              }
              hint={`${vocab.appointments} que já passaram`}
            />
            <PendingLink
              href="/app/event-types"
              icon={LinkIcon}
              tone="sea"
              title="Seu link de agendamento"
              hint={`${APP_DOMAIN}/${user.username}`}
            />
          </section>
        </div>
      </div>
    </>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  foot,
  accent,
  currency,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  foot: React.ReactNode
  accent?: boolean
  currency?: boolean
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[126px] items-start gap-3.5 overflow-hidden rounded-[13px] border bg-card p-4 sm:p-5",
        accent && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-sea",
      )}
    >
      <span className="hidden size-[37px] shrink-0 place-items-center rounded-[9px] bg-sea-50 text-sea sm:grid">
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </span>
      <div className="grid min-w-0 gap-0.5">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <strong
          className={cn(
            "my-[3px] font-bold text-primary dark:text-foreground",
            currency ? "text-[21px] leading-[1.4] tracking-tight" : "text-[28px] leading-[1.1]",
          )}
        >
          {value}
        </strong>
        <small className="text-[13px] text-muted-foreground [&_b]:font-semibold [&_b]:text-ok">{foot}</small>
      </div>
    </div>
  )
}

function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[70px] items-center justify-between gap-[15px] border-b px-[19px] py-[17px]">
      <div>
        <h2 className="text-base font-semibold text-primary dark:text-foreground">{title}</h2>
        {subtitle && (
          <span className="mt-[3px] block text-[13px] text-muted-foreground first-letter:uppercase">
            {subtitle}
          </span>
        )}
      </div>
      {action}
    </div>
  )
}

function PendingLink({
  href,
  icon: Icon,
  title,
  hint,
  tone,
}: {
  href: string
  icon: LucideIcon
  title: string
  hint: string
  tone: "warm" | "sea"
}) {
  return (
    <Link
      href={href}
      className="grid grid-cols-[34px_1fr_16px] items-center gap-2.5 border-b border-line-soft px-[18px] py-3 last:border-b-0 hover:bg-muted"
    >
      <span
        className={cn(
          "grid size-[31px] place-items-center rounded-[8px]",
          tone === "warm" ? "bg-warm-50 text-warm-foreground" : "bg-sea-50 text-sea",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <strong className="truncate text-[13px] font-semibold">{title}</strong>
        <small className="truncate text-xs text-muted-foreground">{hint}</small>
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </Link>
  )
}
