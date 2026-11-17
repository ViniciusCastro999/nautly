"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { CalendarOffIcon, CopyIcon, GlobeIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TIMEZONES, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/constants"
import { minutesToTime, timeToMinutes, tzLabel } from "@/lib/format"
import { saveAvailability } from "@/server/availability"

type Rule = { weekday: number; startMinute: number; endMinute: number }
type Interval = { start: string; end: string }

// Segunda primeiro, como em calendários brasileiros.
const ORDER = [1, 2, 3, 4, 5, 6, 0]

export function AvailabilityEditor(props: { timezone: string; rules: Rule[]; blockedDates: string[] }) {
  const [timezone, setTimezone] = useState(props.timezone)
  const [days, setDays] = useState<Record<number, Interval[]>>(() => {
    const map: Record<number, Interval[]> = {}
    for (let d = 0; d < 7; d++) {
      map[d] = props.rules
        .filter((r) => r.weekday === d)
        .sort((a, b) => a.startMinute - b.startMinute)
        .map((r) => ({ start: minutesToTime(r.startMinute), end: minutesToTime(r.endMinute) }))
    }
    return map
  })
  const [blocked, setBlocked] = useState<string[]>([...props.blockedDates].sort())
  const [newDate, setNewDate] = useState("")
  const [pending, startTransition] = useTransition()

  const timezones = useMemo(
    () => (TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]),
    [timezone],
  )

  function update(day: number, fn: (list: Interval[]) => Interval[]) {
    setDays((prev) => ({ ...prev, [day]: fn(prev[day]) }))
  }

  function copyToWeekdays(day: number) {
    setDays((prev) => {
      const next = { ...prev }
      for (const d of [1, 2, 3, 4, 5]) next[d] = prev[day].map((i) => ({ ...i }))
      return next
    })
    toast.success("Horários copiados para segunda a sexta")
  }

  function save() {
    const rules: Rule[] = Object.entries(days).flatMap(([weekday, list]) =>
      list.map((i) => ({
        weekday: Number(weekday),
        startMinute: timeToMinutes(i.start),
        endMinute: timeToMinutes(i.end),
      })),
    )
    startTransition(async () => {
      const res = await saveAvailability({ timezone, rules, blockedDates: blocked })
      if (res.ok) toast.success("Disponibilidade salva")
      else toast.error(res.error)
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Horários semanais</CardTitle>
          <CardDescription>Adicione um ou mais intervalos por dia.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {ORDER.map((day) => {
            const list = days[day]
            const enabled = list.length > 0
            return (
              <div
                key={day}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
              >
                <div className="flex w-36 shrink-0 items-center gap-3 pt-1.5">
                  <Switch
                    checked={enabled}
                    aria-label={WEEKDAYS[day]}
                    onCheckedChange={(on) =>
                      update(day, () => (on ? [{ start: "09:00", end: "17:00" }] : []))
                    }
                  />
                  <span className="text-sm font-bold tracking-wide">{WEEKDAYS_SHORT[day]}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {!enabled && <p className="pt-2 text-sm text-muted-foreground">Indisponível</p>}
                  {list.map((interval, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        value={interval.start}
                        className="h-9 w-28"
                        aria-label="Início"
                        onChange={(e) =>
                          update(day, (l) =>
                            l.map((it, i) => (i === idx ? { ...it, start: e.target.value } : it)),
                          )
                        }
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        step={900}
                        value={interval.end}
                        className="h-9 w-28"
                        aria-label="Fim"
                        onChange={(e) =>
                          update(day, (l) =>
                            l.map((it, i) => (i === idx ? { ...it, end: e.target.value } : it)),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remover intervalo"
                        onClick={() => update(day, (l) => l.filter((_, i) => i !== idx))}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 sm:pt-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Adicionar intervalo"
                        onClick={() =>
                          update(day, (l) => {
                            const last = l.at(-1)
                            if (!last) return [{ start: "09:00", end: "17:00" }]
                            const start = Math.min(timeToMinutes(last.end) + 60, 22 * 60)
                            return [
                              ...l,
                              {
                                start: minutesToTime(start),
                                end: minutesToTime(Math.min(start + 60, 23 * 60 + 45)),
                              },
                            ]
                          })
                        }
                      >
                        <PlusIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Adicionar intervalo</TooltipContent>
                  </Tooltip>
                  {enabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Copiar para dias úteis"
                          onClick={() => copyToWeekdays(day)}
                        >
                          <CopyIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar para segunda a sexta</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid h-fit gap-6 lg:sticky lg:top-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GlobeIcon className="size-4" /> Fuso horário
            </CardTitle>
            <CardDescription>Seus horários são interpretados neste fuso.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="h-10 w-full">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOffIcon className="size-4" /> Dias bloqueados
            </CardTitle>
            <CardDescription>Feriados, férias ou folgas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex gap-2">
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-9"
              />
              <Button
                variant="outline"
                disabled={!newDate}
                onClick={() => {
                  setBlocked((b) => [...new Set([...b, newDate])].sort())
                  setNewDate("")
                }}
              >
                Bloquear
              </Button>
            </div>
            {blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dia bloqueado.</p>
            ) : (
              <ul className="grid gap-1.5">
                {blocked.map((d) => (
                  <li
                    key={d}
                    className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-sm"
                  >
                    <span className="inline-block first-letter:uppercase">
                      {format(parseISO(d), "EEE, d 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Desbloquear"
                      onClick={() => setBlocked((b) => b.filter((x) => x !== d))}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Button onClick={save} disabled={pending} className="h-10">
          {pending && <Loader2Icon className="animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  )
}
