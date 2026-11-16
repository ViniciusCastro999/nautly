import { TZDate } from "@date-fns/tz"

export type WeeklyRule = { weekday: number; startMinute: number; endMinute: number }
/** startMinute/endMinute nulos = dia inteiro bloqueado. */
export type DateOverride = { date: string; startMinute: number | null; endMinute: number | null }
export type BusyInterval = { start: Date; end: Date }

export interface SlotInput {
  /** Fuso do profissional (onde a disponibilidade foi definida). */
  timezone: string
  rules: WeeklyRule[]
  overrides: DateOverride[]
  /** Agendamentos já existentes do profissional. */
  busy: BusyInterval[]
  durationMinutes: number
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  minNoticeMinutes?: number
  maxDaysAhead?: number
  /** Intervalo entre inícios de horários. Padrão: a própria duração. */
  stepMinutes?: number
  from: Date
  to: Date
  now: Date
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** "2026-11-16" para uma data de calendário em UTC (só usamos y/m/d). */
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * Calcula os horários livres (instantes UTC) entre `from` e `to`.
 *
 * A disponibilidade é expressa em horário local do profissional
 * ("segunda, 09:00–12:00 em America/Sao_Paulo"). Para cada dia de calendário
 * nesse fuso, geramos as janelas e convertemos para instantes absolutos com
 * TZDate. Isso trata corretamente horário de verão e qualquer fuso do convidado,
 * que apenas formata os instantes no próprio fuso.
 */
export function computeSlots(input: SlotInput): Date[] {
  const {
    timezone,
    rules,
    overrides,
    busy,
    durationMinutes,
    bufferBeforeMinutes = 0,
    bufferAfterMinutes = 0,
    minNoticeMinutes = 0,
    maxDaysAhead = 365,
    now,
  } = input
  const step = input.stepMinutes ?? durationMinutes
  if (durationMinutes <= 0 || step <= 0) return []

  const earliest = Math.max(input.from.getTime(), now.getTime() + minNoticeMinutes * MINUTE)
  const latest = Math.min(input.to.getTime(), now.getTime() + maxDaysAhead * DAY)
  if (earliest >= latest) return []

  const overridesByDate = new Map<string, DateOverride[]>()
  for (const o of overrides) {
    const list = overridesByDate.get(o.date) ?? []
    list.push(o)
    overridesByDate.set(o.date, list)
  }

  const busyMs = busy.map((b) => [b.start.getTime(), b.end.getTime()] as const).sort((a, b) => a[0] - b[0])

  // Primeiro dia de calendário (no fuso do profissional) que pode conter slots.
  const startLocal = new TZDate(earliest - DAY, timezone)
  let cursor = new Date(Date.UTC(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate()))

  const result: Date[] = []

  while (true) {
    const y = cursor.getUTCFullYear()
    const m = cursor.getUTCMonth()
    const d = cursor.getUTCDate()
    const dayStart = new TZDate(y, m, d, 0, 0, 0, timezone).getTime()
    if (dayStart > latest) break

    const dateKey = isoDate(cursor)
    const dayOverrides = overridesByDate.get(dateKey)
    const windows = dayOverrides
      ? dayOverrides
          .filter((o) => o.startMinute != null && o.endMinute != null)
          .map((o) => ({
            startMinute: o.startMinute!,
            endMinute: o.endMinute!,
          }))
      : rules.filter((r) => r.weekday === cursor.getUTCDay())

    for (const w of windows) {
      for (let t = w.startMinute; t + durationMinutes <= w.endMinute; t += step) {
        const start = new TZDate(y, m, d, Math.floor(t / 60), t % 60, 0, timezone).getTime()
        const end = start + durationMinutes * MINUTE
        if (start < earliest || start > latest) continue

        const blockStart = start - bufferBeforeMinutes * MINUTE
        const blockEnd = end + bufferAfterMinutes * MINUTE
        const conflict = busyMs.some(([bs, be]) => blockStart < be && blockEnd > bs)
        if (!conflict) result.push(new Date(start))
      }
    }

    cursor = new Date(cursor.getTime() + DAY)
  }

  return result.sort((a, b) => a.getTime() - b.getTime())
}

/** Verifica se um início específico é um horário válido (usado ao confirmar). */
export function isSlotAvailable(input: Omit<SlotInput, "from" | "to">, start: Date): boolean {
  const from = new Date(start.getTime() - MINUTE)
  const to = new Date(start.getTime() + MINUTE)
  return computeSlots({ ...input, from, to }).some((s) => s.getTime() === start.getTime())
}
