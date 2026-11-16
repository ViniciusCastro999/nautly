"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { TZDate } from "@date-fns/tz"
import { CalendarIcon, ClockIcon } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { CalendarMode } from "@/lib/calendar"
import { WEEKDAYS_SHORT } from "@/lib/constants"
import { formatInTz } from "@/lib/format"
import { cn } from "@/lib/utils"
import { BookingActions, BookingInfo, type BookingView } from "../booking-details"

const HOUR_HEIGHT = 48
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const HOURS = Array.from({ length: 24 }, (_, h) => h)

type Props = {
  mode: CalendarMode
  days: string[]
  monthKey: string
  todayKey: string
  timezone: string
  bookings: BookingView[]
}

export function BookingsCalendar(props: Props) {
  const [selected, setSelected] = useState<BookingView | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, BookingView[]>()
    for (const b of props.bookings) {
      const key = formatInTz(b.startsAt, props.timezone, "yyyy-MM-dd")
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return map
  }, [props.bookings, props.timezone])

  return (
    <>
      {props.mode === "month" ? (
        <MonthGrid {...props} byDay={byDay} onSelect={setSelected} />
      ) : (
        <TimeGrid {...props} byDay={byDay} onSelect={setSelected} />
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent className="overflow-hidden pt-0 sm:max-w-md">
            <div className="-mx-6 h-2" style={{ backgroundColor: selected.eventType.color }} />
            <DialogHeader>
              <DialogTitle className="text-xl">{selected.contact.name}</DialogTitle>
              <DialogDescription>{selected.eventType.title}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4 text-muted-foreground" />
                <span className="first-letter:uppercase">
                  {formatInTz(selected.startsAt, props.timezone, "EEEE, d 'de' MMMM")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 text-muted-foreground" />
                {formatInTz(selected.startsAt, props.timezone, "HH:mm")} às{" "}
                {formatInTz(selected.endsAt, props.timezone, "HH:mm")}
              </div>
            </div>
            <BookingInfo booking={selected} />
            <div className="mt-2">
              <BookingActions
                // remonta ao trocar de agendamento para zerar o estado local
                key={selected.id}
                booking={selected}
                timezone={props.timezone}
                onChanged={() => setSelected(null)}
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                                     Mês                                    */
/* -------------------------------------------------------------------------- */

const MAX_PER_CELL = 3

function MonthGrid({
  days,
  monthKey,
  todayKey,
  timezone,
  byDay,
  onSelect,
}: Props & { byDay: Map<string, BookingView[]>; onSelect: (b: BookingView) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS_SHORT.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid auto-rows-[minmax(110px,1fr)] grid-cols-7">
        {days.map((key, i) => {
          const list = byDay.get(key) ?? []
          const outside = !key.startsWith(monthKey)
          const isToday = key === todayKey
          return (
            <div
              key={key}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 border-b p-1 sm:p-1.5",
                i % 7 !== 6 && "border-r",
                i >= days.length - 7 && "border-b-0",
                outside && "bg-muted/40",
              )}
            >
              <Link
                href={`/app/bookings?view=calendar&mode=day&date=${key}`}
                className={cn(
                  "mx-auto mb-0.5 flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors hover:bg-muted",
                  outside && "text-muted-foreground",
                  isToday && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {Number(key.slice(8))}
              </Link>
              {list.slice(0, MAX_PER_CELL).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelect(b)}
                  className="flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted sm:text-xs"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: b.eventType.color }}
                  />
                  <span className="hidden shrink-0 text-muted-foreground tabular-nums sm:inline">
                    {formatInTz(b.startsAt, timezone, "HH:mm")}
                  </span>
                  <span className="truncate font-medium">{b.contact.name}</span>
                </button>
              ))}
              {list.length > MAX_PER_CELL && (
                <Link
                  href={`/app/bookings?view=calendar&mode=day&date=${key}`}
                  className="px-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground sm:text-xs"
                >
                  +{list.length - MAX_PER_CELL} mais
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Dia / Semana                               */
/* -------------------------------------------------------------------------- */

type Positioned = { booking: BookingView; top: number; height: number; lane: number; lanes: number }

/** Distribui eventos sobrepostos em colunas lado a lado (como no Google Agenda). */
function layoutDay(list: BookingView[], timezone: string): Positioned[] {
  const items = list
    .map((b) => {
      const s = new TZDate(new Date(b.startsAt), timezone)
      const startMin = s.getHours() * 60 + s.getMinutes()
      const duration = (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60_000
      const endMin = Math.min(startMin + duration, 24 * 60)
      return { booking: b, startMin, endMin }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  const result: Positioned[] = []
  let cluster: ((typeof items)[number] & { lane: number })[] = []
  let clusterEnd = -1

  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    for (const c of cluster) {
      result.push({
        booking: c.booking,
        top: c.startMin * MINUTE_HEIGHT,
        height: Math.max((c.endMin - c.startMin) * MINUTE_HEIGHT, 18),
        lane: c.lane,
        lanes,
      })
    }
    cluster = []
  }

  for (const item of items) {
    if (cluster.length && item.startMin >= clusterEnd) flush()
    const laneEnds: number[] = []
    for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.endMin)
    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) lane = laneEnds.length
    cluster.push({ ...item, lane })
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  if (cluster.length) flush()
  return result
}

const subscribeMinute = (cb: () => void) => {
  const id = setInterval(cb, 30_000)
  return () => clearInterval(id)
}

function TimeGrid({
  mode,
  days,
  todayKey,
  timezone,
  byDay,
  onSelect,
}: Props & { byDay: Map<string, BookingView[]>; onSelect: (b: BookingView) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Minuto atual no fuso do profissional; null no servidor (evita divergência de hidratação).
  const nowMinute = useSyncExternalStore(
    subscribeMinute,
    () => {
      const n = new TZDate(new Date(), timezone)
      return n.getHours() * 60 + n.getMinutes()
    },
    () => null,
  )

  // Rola até o primeiro compromisso do período, ou 07:00.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const tops = days.flatMap((d) => layoutDay(byDay.get(d) ?? [], timezone).map((p) => p.top))
    const target = tops.length ? Math.min(...tops) - HOUR_HEIGHT : 7 * HOUR_HEIGHT
    el.scrollTop = Math.max(0, Math.min(target, 7 * HOUR_HEIGHT))
  }, [days, byDay, timezone])

  const cols = days.length

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <div className={cn(mode === "week" && "min-w-[720px]")}>
          {/* Cabeçalho dos dias */}
          <div
            className="grid border-b"
            style={{ gridTemplateColumns: `56px repeat(${cols}, minmax(0, 1fr))` }}
          >
            <div />
            {days.map((key) => {
              const d = new Date(`${key}T12:00:00`)
              const isToday = key === todayKey
              return (
                <Link
                  key={key}
                  href={`/app/bookings?view=calendar&mode=day&date=${key}`}
                  className={cn(
                    "flex flex-col items-center gap-0.5 border-l py-2 transition-colors hover:bg-muted/50",
                    mode === "day" && "items-start pl-4",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold tracking-wide text-muted-foreground",
                      isToday && "text-primary",
                    )}
                  >
                    {WEEKDAYS_SHORT[d.getDay()]}
                  </span>
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-xl font-semibold",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Grade de horas */}
          <div ref={scrollRef} className="max-h-[calc(100svh-300px)] min-h-[420px] overflow-y-auto">
            <div
              className="relative grid"
              style={{
                gridTemplateColumns: `56px repeat(${cols}, minmax(0, 1fr))`,
                height: 24 * HOUR_HEIGHT,
              }}
            >
              {/* Rótulos das horas */}
              <div className="relative">
                {HOURS.slice(1).map((h) => (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
                    style={{ top: h * HOUR_HEIGHT }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>

              {days.map((key) => {
                const positioned = layoutDay(byDay.get(key) ?? [], timezone)
                const isToday = key === todayKey
                return (
                  <div key={key} className="relative border-l">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-border/70"
                        style={{ top: h * HOUR_HEIGHT }}
                      />
                    ))}

                    {positioned.map(({ booking: b, top, height, lane, lanes }) => {
                      const compact = height < 40
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onSelect(b)}
                          className="absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs shadow-xs transition hover:z-10 hover:shadow-md focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            top: top + 1,
                            height: height - 2,
                            left: `calc(${(lane / lanes) * 100}% + 2px)`,
                            width: `calc(${100 / lanes}% - 4px)`,
                            borderLeftColor: b.eventType.color,
                            backgroundColor: `color-mix(in oklab, ${b.eventType.color} 16%, var(--card))`,
                          }}
                        >
                          <span className={cn("block truncate font-semibold", compact && "inline")}>
                            {b.contact.name}
                          </span>
                          <span
                            className={cn("block truncate text-muted-foreground", compact && "ml-1 inline")}
                          >
                            {formatInTz(b.startsAt, timezone, "HH:mm")}
                            {!compact && ` às ${formatInTz(b.endsAt, timezone, "HH:mm")}`}
                          </span>
                          {!compact && height > 60 && (
                            <span className="block truncate text-muted-foreground">{b.eventType.title}</span>
                          )}
                        </button>
                      )
                    })}

                    {isToday && nowMinute !== null && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                        style={{ top: nowMinute * MINUTE_HEIGHT }}
                      >
                        <span className="-ml-1.5 size-3 rounded-full bg-red-500" />
                        <span className="h-0.5 flex-1 bg-red-500" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
