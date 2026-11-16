/**
 * Ocorrências de um agendamento recorrente. O horário é mantido no relógio
 * local do profissional: "toda terça às 14:00" continua às 14:00 depois de uma
 * mudança de horário de verão, mesmo que o instante UTC mude.
 */
import { addDays, addMinutes, parseISO } from "date-fns"
import { TZDate } from "@date-fns/tz"

export type Repeat = "none" | "weekly" | "biweekly"

export const REPEAT_LABELS: Record<Repeat, string> = {
  none: "Não se repete",
  weekly: "Toda semana",
  biweekly: "A cada 2 semanas",
}

export const MAX_OCCURRENCES = 52

export type Interval = { startsAt: Date; endsAt: Date }

export function buildOccurrences(input: {
  /** Data da primeira ocorrência, "yyyy-MM-dd". */
  date: string
  /** Horário local, "HH:mm". */
  time: string
  timezone: string
  durationMinutes: number
  repeat: Repeat
  count: number
}): Interval[] {
  const total = input.repeat === "none" ? 1 : Math.min(Math.max(input.count, 1), MAX_OCCURRENCES)
  const step = input.repeat === "biweekly" ? 14 : 7
  const [hours, minutes] = input.time.split(":").map(Number)
  const first = parseISO(input.date)

  return Array.from({ length: total }, (_, i) => {
    const day = addDays(first, i * step)
    const start = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, input.timezone)
    const startsAt = new Date(start.getTime())
    return { startsAt, endsAt: addMinutes(startsAt, input.durationMinutes) }
  })
}

/** Separa ocorrências livres das que colidem com agendamentos existentes. */
export function splitConflicts(occurrences: Interval[], existing: Interval[]) {
  const free: Interval[] = []
  const conflicts: Interval[] = []
  for (const o of occurrences) {
    const clash = existing.some((e) => o.startsAt < e.endsAt && e.startsAt < o.endsAt)
    ;(clash ? conflicts : free).push(o)
  }
  return { free, conflicts }
}
