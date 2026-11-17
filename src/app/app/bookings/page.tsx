import type { Metadata } from "next"
import Link from "next/link"
import { and, asc, desc, eq, gt, gte, lt } from "drizzle-orm"
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  CalendarXIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { BookingRow } from "@/components/app/booking-row"
import type { BookingView } from "@/components/app/booking-details"
import { BookingsCalendar } from "@/components/app/calendar/bookings-calendar"
import { NewBookingDialog } from "@/components/app/new-booking-dialog"
import { db, schema } from "@/db"
import { CALENDAR_MODES, calendarRange, type CalendarMode } from "@/lib/calendar"
import { formatInTz } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Agenda" }

const TABS = [
  { key: "upcoming", label: "Próximos" },
  { key: "past", label: "Passados" },
  { key: "cancelled", label: "Cancelados" },
] as const
type TabKey = (typeof TABS)[number]["key"]

const MODE_LABELS: Record<CalendarMode, string> = { day: "Dia", week: "Semana", month: "Mês" }

type BookingWithRelations = Awaited<ReturnType<typeof loadBookings>>[number]

function loadBookings(where: Parameters<typeof db.query.booking.findMany>[0]) {
  return db.query.booking.findMany({ ...where, with: { eventType: true, contact: true }, limit: 500 })
}

function toView(b: BookingWithRelations): BookingView {
  return {
    id: b.id,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    notes: b.notes,
    cancelReason: b.cancelReason,
    inviteeTimezone: b.inviteeTimezone,
    attendance: b.attendance,
    seriesId: b.seriesId,
    contactId: b.contactId,
    contact: { name: b.contact.name, email: b.contact.email, phone: b.contact.phone },
    eventType: {
      title: b.eventType.title,
      color: b.eventType.color,
      locationType: b.eventType.locationType,
      locationDetail: b.eventType.locationDetail,
    },
  }
}

export default async function BookingsPage({ searchParams }: PageProps<"/app/bookings">) {
  const params = await searchParams
  const view = params.view === "calendar" ? "calendar" : "list"
  const ctx = await requireWorkspace()
  const [contacts, eventTypes] = ctx.can("agenda:manage")
    ? await Promise.all([
        db.query.contact.findMany({
          where: eq(schema.contact.organizationId, ctx.org.id),
          columns: { id: true, name: true },
          orderBy: [asc(schema.contact.name)],
        }),
        db.query.eventType.findMany({
          where: and(
            eq(schema.eventType.organizationId, ctx.org.id),
            eq(schema.eventType.hostId, ctx.user.id),
          ),
          columns: { id: true, title: true, durationMinutes: true, color: true },
          orderBy: [asc(schema.eventType.createdAt)],
        }),
      ])
    : [[], []]

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Tudo o que você precisa para organizar o dia."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {ctx.can("agenda:manage") && (
              <NewBookingDialog
                contacts={contacts}
                eventTypes={eventTypes}
                recurringEnabled={ctx.hasModule("recurring")}
                defaultDate={formatInTz(new Date(), ctx.user.timezone, "yyyy-MM-dd")}
                clientNoun={ctx.vocab.client}
              >
                <Button size="lg">
                  <CalendarPlusIcon /> Novo agendamento
                </Button>
              </NewBookingDialog>
            )}
            <div className="inline-flex rounded-[10px] border bg-card p-1">
              {[
                { key: "list", label: "Lista", icon: ListIcon, href: "/app/bookings" },
                {
                  key: "calendar",
                  label: "Calendário",
                  icon: CalendarDaysIcon,
                  href: "/app/bookings?view=calendar",
                },
              ].map(({ key, label, icon: Icon, href }) => (
                <Link
                  key={key}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                    view === key
                      ? "bg-sea-50 text-primary dark:text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              ))}
            </div>
          </div>
        }
      />
      {view === "calendar" ? (
        <CalendarSection
          mode={CALENDAR_MODES.includes(params.mode as CalendarMode) ? (params.mode as CalendarMode) : "week"}
          date={typeof params.date === "string" ? params.date : undefined}
        />
      ) : (
        <ListSection tab={TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "upcoming"} />
      )}
    </>
  )
}

async function CalendarSection({ mode, date }: { mode: CalendarMode; date?: string }) {
  const { user, org } = await requireWorkspace()
  const range = calendarRange(mode, date, user.timezone)

  const bookings = await loadBookings({
    where: and(
      eq(schema.booking.organizationId, org.id),
      eq(schema.booking.status, "confirmed"),
      lt(schema.booking.startsAt, range.end),
      gt(schema.booking.endsAt, range.start),
    ),
    orderBy: [asc(schema.booking.startsAt)],
  })

  const href = (m: CalendarMode, d: string) => `/app/bookings?view=calendar&mode=${m}&date=${d}`

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href={href(mode, range.todayKey)}>Hoje</Link>
        </Button>
        <div className="flex items-center">
          <Button asChild variant="ghost" size="icon" aria-label="Anterior">
            <Link href={href(mode, range.prevKey)}>
              <ChevronLeftIcon />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Próximo">
            <Link href={href(mode, range.nextKey)}>
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-primary first-letter:uppercase sm:text-xl dark:text-foreground">
          {range.title}
        </h2>
        <div className="ml-auto inline-flex rounded-[10px] border bg-card p-1">
          {CALENDAR_MODES.map((m) => (
            <Link
              key={m}
              href={href(m, range.anchorKey)}
              className={cn(
                "rounded-[7px] px-3 py-1 text-[13px] font-semibold transition-colors",
                mode === m
                  ? "bg-sea-50 text-primary dark:text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {MODE_LABELS[m]}
            </Link>
          ))}
        </div>
      </div>
      <BookingsCalendar
        // remonta ao trocar de período para reposicionar a rolagem
        key={`${mode}-${range.days[0]}`}
        mode={mode}
        days={range.days}
        monthKey={range.monthKey}
        todayKey={range.todayKey}
        timezone={user.timezone}
        bookings={bookings.map(toView)}
      />
    </>
  )
}

async function ListSection({ tab }: { tab: TabKey }) {
  const { user, org } = await requireWorkspace()
  const now = new Date()

  const where =
    tab === "cancelled"
      ? and(eq(schema.booking.organizationId, org.id), eq(schema.booking.status, "cancelled"))
      : and(
          eq(schema.booking.organizationId, org.id),
          eq(schema.booking.status, "confirmed"),
          tab === "upcoming" ? gte(schema.booking.endsAt, now) : lt(schema.booking.endsAt, now),
        )

  const bookings = await loadBookings({
    where,
    orderBy: tab === "upcoming" ? [asc(schema.booking.startsAt)] : [desc(schema.booking.startsAt)],
  })

  // Agrupa por dia, no fuso do profissional.
  const groups = new Map<string, BookingWithRelations[]>()
  for (const b of bookings) {
    const key = formatInTz(b.startsAt, user.timezone, "yyyy-MM-dd")
    groups.set(key, [...(groups.get(key) ?? []), b])
  }

  return (
    <>
      <div className="mb-[17px] inline-flex rounded-[10px] border bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/bookings?tab=${t.key}`}
            className={cn(
              "rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              tab === t.key
                ? "bg-sea-50 text-primary dark:text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center rounded-[13px] border bg-card p-12 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-[11px] bg-sea-50 text-sea">
            <CalendarXIcon className="size-5" />
          </span>
          <p className="font-semibold">Nenhum agendamento por aqui</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Compartilhe seu link para começar a receber agendamentos.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[13px] border bg-card">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day} className="not-first:border-t">
              <h2 className="border-b px-[19px] py-4 text-base font-semibold text-primary first-letter:uppercase dark:text-foreground">
                {formatInTz(list[0].startsAt, user.timezone, "EEEE, d 'de' MMMM 'de' yyyy")}
              </h2>
              <ul className="divide-y divide-line-soft">
                {list.map((b) => (
                  <BookingRow key={b.id} timezone={user.timezone} booking={toView(b)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
