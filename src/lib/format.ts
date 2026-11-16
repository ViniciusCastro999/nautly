import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Formata um instante em um fuso específico, em pt-BR. */
export function formatInTz(date: Date | string, timezone: string, pattern: string) {
  return format(new TZDate(new Date(date), timezone), pattern, { locale: ptBR })
}

export function minutesToTime(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0")
  const m = String(minutes % 60).padStart(2, "0")
  return `${h}:${m}`
}

export function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

export function tzLabel(timezone: string) {
  const city = timezone.split("/").pop()!.replaceAll("_", " ")
  try {
    const offset = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value
    return `${city} (${offset})`
  } catch {
    return city
  }
}
