import { TZDate } from "@date-fns/tz"
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"

export const CALENDAR_MODES = ["day", "week", "month"] as const
export type CalendarMode = (typeof CALENDAR_MODES)[number]

const KEY = "yyyy-MM-dd"
const KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

function fromKey(key: string, tz: string) {
  const [y, m, d] = key.split("-").map(Number)
  return new TZDate(y, m - 1, d, tz)
}

/**
 * Calcula o intervalo exibido (no fuso do profissional), os dias da grade,
 * as datas de navegação e o título de uma visão do calendário.
 */
export function calendarRange(mode: CalendarMode, dateKey: string | undefined, tz: string) {
  const today = new TZDate(new Date(), tz)
  const todayKey = format(today, KEY)
  const anchor = dateKey && KEY_REGEX.test(dateKey) ? fromKey(dateKey, tz) : fromKey(todayKey, tz)

  let start: TZDate
  let end: TZDate
  let prev: TZDate
  let next: TZDate
  let title: string

  if (mode === "day") {
    start = anchor
    end = addDays(anchor, 1)
    prev = addDays(anchor, -1)
    next = addDays(anchor, 1)
    title = format(anchor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  } else if (mode === "week") {
    start = startOfWeek(anchor, { weekStartsOn: 0 })
    end = addDays(start, 7)
    prev = addDays(anchor, -7)
    next = addDays(anchor, 7)
    const last = addDays(start, 6)
    title = isSameMonth(start, last)
      ? `${format(start, "d")} a ${format(last, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
      : isSameYear(start, last)
        ? `${format(start, "d 'de' MMM", { locale: ptBR })} a ${format(last, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
        : `${format(start, "d 'de' MMM 'de' yyyy", { locale: ptBR })} a ${format(last, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
  } else {
    start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 })
    end = addDays(startOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }), 7)
    prev = addMonths(anchor, -1)
    next = addMonths(anchor, 1)
    title = format(anchor, "MMMM 'de' yyyy", { locale: ptBR })
  }

  const days: string[] = []
  for (let d = start; d < end; d = addDays(d, 1)) days.push(format(d, KEY))

  return {
    start: new Date(start.getTime()),
    end: new Date(end.getTime()),
    days,
    title,
    anchorKey: format(anchor, KEY),
    monthKey: format(anchor, "yyyy-MM"),
    todayKey,
    prevKey: format(prev, KEY),
    nextKey: format(next, KEY),
  }
}
