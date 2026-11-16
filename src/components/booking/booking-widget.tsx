"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  Loader2Icon,
  MapPinIcon,
  PhoneIcon,
  VideoIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { LOCATION_LABELS, TIMEZONES, WEEKDAYS_SHORT } from "@/lib/constants"
import { formatDuration, initials, tzLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import { bookSlot } from "@/server/public-booking"

type Props = {
  host: { name: string }
  eventType: {
    id: string
    title: string
    description: string | null
    durationMinutes: number
    locationType: keyof typeof LOCATION_LABELS
    locationDetail: string | null
    color: string
  }
}

const LOCATION_ICONS = { video: VideoIcon, phone: PhoneIcon, in_person: MapPinIcon }

function fmt(date: Date | string, tz: string, pattern: string) {
  return format(new TZDate(new Date(date), tz), pattern, { locale: ptBR })
}

export function BookingWidget({ host, eventType }: Props) {
  const router = useRouter()
  // Este componente só renderiza no cliente (ver booking-widget-loader),
  // então podemos ler o fuso do navegador já no estado inicial.
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [month, setMonth] = useState(() => {
    const now = new TZDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)
    return { y: now.getFullYear(), m: now.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [step, setStep] = useState<"pick" | "form">("pick")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [reloadKey, setReloadKey] = useState(0)

  // Resultado associado à "chave" da consulta: se a chave mudou, ainda está carregando.
  const queryKey = `${month.y}-${month.m}|${timezone}|${reloadKey}`
  const [result, setResult] = useState<{ key: string; slots: string[] } | null>(null)
  const slots = result?.key === queryKey ? result.slots : null

  useEffect(() => {
    const controller = new AbortController()
    // Limites do mês no fuso do convidado, enviados em UTC.
    const params = new URLSearchParams({
      eventTypeId: eventType.id,
      from: new Date(new TZDate(month.y, month.m, 1, timezone).getTime()).toISOString(),
      to: new Date(new TZDate(month.y, month.m + 1, 1, timezone).getTime()).toISOString(),
    })
    fetch(`/api/slots?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((data: { slots?: string[] }) => setResult({ key: queryKey, slots: data.slots ?? [] }))
      .catch(() => {})
    return () => controller.abort()
  }, [month, timezone, eventType.id, queryKey])

  const slotsByDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of slots ?? []) {
      const key = fmt(s, timezone, "yyyy-MM-dd")
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return map
  }, [slots, timezone])

  const todayKey = fmt(new Date(), timezone, "yyyy-MM-dd")
  const timezones = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]
  const LocationIcon = LOCATION_ICONS[eventType.locationType]

  function changeMonth(delta: number) {
    const d = new Date(Date.UTC(month.y, month.m + delta, 1))
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() })
    setSelectedDay(null)
    setSelectedSlot(null)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedSlot) return
    const form = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await bookSlot({
        eventTypeId: eventType.id,
        startsAt: selectedSlot,
        name: String(form.get("name")),
        email: String(form.get("email")),
        phone: String(form.get("phone") ?? ""),
        notes: String(form.get("notes") ?? ""),
        timezone,
      })
      if (res.ok) {
        router.push(`/booking/${res.token}`)
        return
      }
      setError(res.error)
      if (res.slotTaken) {
        toast.error(res.error)
        setSelectedSlot(null)
        setStep("pick")
        setReloadKey((k) => k + 1)
      }
    })
  }

  const isCurrentMonth = (() => {
    const now = new TZDate(new Date(), timezone)
    return month.y === now.getFullYear() && month.m === now.getMonth()
  })()

  return (
    <div
      className={cn(
        "mx-auto grid w-full overflow-hidden rounded-2xl border bg-card shadow-[0_1px_8px_rgba(0,0,0,0.08)] transition-[max-width] duration-300 dark:shadow-none",
        step === "pick" && selectedDay
          ? "max-w-5xl md:grid-cols-[320px_1fr]"
          : "max-w-4xl md:grid-cols-[320px_1fr]",
      )}
    >
      {/* Painel de informações */}
      <div className="border-b p-6 md:border-r md:border-b-0 md:p-8">
        {step === "form" && (
          <Button
            variant="outline"
            size="icon"
            className="mb-5 rounded-full text-primary"
            aria-label="Voltar"
            onClick={() => setStep("pick")}
          >
            <ArrowLeftIcon />
          </Button>
        )}
        <Avatar className="mb-4 size-14">
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {initials(host.name)}
          </AvatarFallback>
        </Avatar>
        <p className="font-medium text-muted-foreground">{host.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{eventType.title}</h1>
        <ul className="mt-5 grid gap-3 font-medium text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <ClockIcon className="size-5 shrink-0" /> {formatDuration(eventType.durationMinutes)}
          </li>
          <li className="flex items-start gap-2.5">
            <LocationIcon className="mt-0.5 size-5 shrink-0" />
            <span>
              {LOCATION_LABELS[eventType.locationType]}
              {eventType.locationType === "in_person" && eventType.locationDetail && (
                <span className="block text-sm font-normal">{eventType.locationDetail}</span>
              )}
            </span>
          </li>
          {step === "form" && selectedSlot && (
            <>
              <li className="flex items-start gap-2.5 text-foreground">
                <CalendarIcon className="mt-0.5 size-5 shrink-0" />
                <span>
                  {fmt(selectedSlot, timezone, "HH:mm")} às{" "}
                  {fmt(
                    new Date(new Date(selectedSlot).getTime() + eventType.durationMinutes * 60_000),
                    timezone,
                    "HH:mm",
                  )}
                  , {fmt(selectedSlot, timezone, "EEEE, d 'de' MMMM 'de' yyyy")}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <GlobeIcon className="size-5 shrink-0" /> {tzLabel(timezone)}
              </li>
            </>
          )}
        </ul>
        {eventType.description && (
          <p className="mt-5 text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
            {eventType.description}
          </p>
        )}
      </div>

      {/* Seleção de data/horário ou formulário */}
      {step === "pick" ? (
        <div className="p-6 md:p-8">
          <h2 className="mb-6 text-xl font-bold">Selecione data e horário</h2>
          <div className={cn("grid gap-8", selectedDay && "lg:grid-cols-[1fr_220px]")}>
            <div>
              {/* Cabeçalho do mês */}
              <div className="mb-4 flex items-center justify-center gap-6">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-primary disabled:text-muted-foreground"
                  disabled={isCurrentMonth}
                  onClick={() => changeMonth(-1)}
                  aria-label="Mês anterior"
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="inline-block w-40 text-center font-medium first-letter:uppercase">
                  {format(new Date(month.y, month.m, 1), "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-accent text-primary hover:bg-accent/70"
                  onClick={() => changeMonth(1)}
                  aria-label="Próximo mês"
                >
                  <ChevronRightIcon />
                </Button>
              </div>

              {/* Grade do mês */}
              <div className="grid grid-cols-7 gap-y-2 text-center">
                {WEEKDAYS_SHORT.map((d) => (
                  <div key={d} className="pb-2 text-xs font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
                {(() => {
                  const firstWeekday = new Date(Date.UTC(month.y, month.m, 1)).getUTCDay()
                  const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate()
                  const cells = []
                  for (let i = 0; i < firstWeekday; i++) cells.push(<div key={`e${i}`} />)
                  for (let d = 1; d <= days; d++) {
                    const key = `${month.y}-${String(month.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                    const available = slotsByDay.has(key)
                    const selected = selectedDay === key
                    cells.push(
                      <div key={key} className="flex justify-center">
                        {slots === null ? (
                          <Skeleton className="size-11 rounded-full" />
                        ) : (
                          <button
                            type="button"
                            disabled={!available}
                            onClick={() => {
                              setSelectedDay(key)
                              setSelectedSlot(null)
                            }}
                            className={cn(
                              "relative flex size-11 items-center justify-center rounded-full text-[15px] transition-colors",
                              available
                                ? "bg-accent font-bold text-primary hover:bg-primary/20"
                                : "text-muted-foreground/70",
                              selected && "bg-primary text-primary-foreground hover:bg-primary",
                            )}
                          >
                            {d}
                            {key === todayKey && (
                              <span
                                className={cn(
                                  "absolute bottom-1.5 size-1 rounded-full",
                                  selected ? "bg-primary-foreground" : "bg-current",
                                )}
                              />
                            )}
                          </button>
                        )}
                      </div>,
                    )
                  }
                  return cells
                })()}
              </div>

              {slots !== null && slots.length === 0 && (
                <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
                  Sem horários disponíveis neste mês.{" "}
                  <button
                    className="font-semibold text-primary hover:underline"
                    onClick={() => changeMonth(1)}
                  >
                    Ver próximo mês
                  </button>
                </p>
              )}

              {/* Fuso horário */}
              <div className="mt-8">
                <p className="mb-2 text-sm font-bold">Fuso horário</p>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-auto w-full border-none px-0 shadow-none hover:bg-transparent sm:w-auto dark:bg-transparent">
                    <GlobeIcon className="text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tzLabel(tz)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lista de horários */}
            {selectedDay && (
              <div className="animate-in fade-in slide-in-from-right-4">
                <p className="mb-4 first-letter:uppercase">
                  {format(new Date(`${selectedDay}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <div className="grid max-h-[400px] gap-2.5 overflow-y-auto pr-1">
                  {(slotsByDay.get(selectedDay) ?? []).map((s) =>
                    selectedSlot === s ? (
                      <div key={s} className="grid grid-cols-2 gap-2">
                        <div className="flex h-12 items-center justify-center rounded-lg bg-muted-foreground/80 font-bold text-background">
                          {fmt(s, timezone, "HH:mm")}
                        </div>
                        <Button
                          className="h-12 rounded-lg text-base font-bold"
                          onClick={() => setStep("form")}
                        >
                          Próximo
                        </Button>
                      </div>
                    ) : (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSlot(s)}
                        className="h-12 rounded-lg border border-primary/50 font-bold text-primary transition-colors hover:border-2 hover:border-primary"
                      >
                        {fmt(s, timezone, "HH:mm")}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid content-start gap-5 p-6 md:p-8">
          <h2 className="text-xl font-bold">Insira seus dados</h2>
          <div className="grid gap-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required autoComplete="name" className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Algo que ajude a preparar o encontro?</Label>
            <Textarea id="notes" name="notes" rows={4} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="h-11 w-fit rounded-full px-6 text-base font-semibold"
            disabled={pending}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Agendar evento
          </Button>
        </form>
      )}
    </div>
  )
}
