"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { CheckIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { schema } from "@/db"
import { EVENT_COLORS, LOCATION_LABELS } from "@/lib/constants"
import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"
import { saveEventType, type EventTypeFormState } from "@/server/event-types"

type EventType = typeof schema.eventType.$inferSelect

const DURATIONS = [15, 20, 30, 45, 50, 60, 90, 120]
const NOTICE_OPTIONS = [
  { value: 0, label: "Sem antecedência mínima" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 240, label: "4 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "1 dia" },
  { value: 2880, label: "2 dias" },
]

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null
}

export function EventTypeForm({ eventType, username }: { eventType?: EventType; username: string }) {
  const [state, action, pending] = useActionState<EventTypeFormState, FormData>(saveEventType, {})
  const [title, setTitle] = useState(eventType?.title ?? "")
  const [slug, setSlug] = useState(eventType?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(eventType))
  const [color, setColor] = useState(eventType?.color ?? EVENT_COLORS[0])
  const [duration, setDuration] = useState(String(eventType?.durationMinutes ?? 30))
  const [locationType, setLocationType] = useState<EventType["locationType"]>(
    eventType?.locationType ?? "video",
  )
  const [isActive, setIsActive] = useState(eventType?.isActive ?? true)
  const errors = state.errors ?? {}

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {eventType && <input type="hidden" name="id" value={eventType.id} />}
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="durationMinutes" value={duration} />
      <input type="hidden" name="locationType" value={locationType} />
      <input type="hidden" name="isActive" value={String(isActive)} />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do evento</CardTitle>
            <CardDescription>O que seus convidados verão ao agendar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="title">Nome do evento</Label>
              <Input
                id="title"
                name="title"
                value={title}
                placeholder="Ex.: Consulta inicial"
                className="h-10"
                aria-invalid={Boolean(errors.title)}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (!slugTouched) setSlug(slugify(e.target.value))
                }}
              />
              <FieldError message={errors.title} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Link do evento</Label>
              <div className="flex h-10 items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="truncate border-r bg-muted px-3 py-2 text-sm text-muted-foreground">
                  nautly.app/{username}/
                </span>
                <input
                  id="slug"
                  name="slug"
                  value={slug}
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(slugify(e.target.value))
                  }}
                />
              </div>
              <FieldError message={errors.slug} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={eventType?.description ?? ""}
                placeholder="Conte ao convidado o que esperar."
              />
            </div>
            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition",
                      color === c && "ring-2 ring-foreground/60",
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <CheckIcon className="size-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duração e local</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {formatDuration(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Local</Label>
              <Select
                value={locationType}
                onValueChange={(v) => setLocationType(v as EventType["locationType"])}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOCATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="locationDetail">
                {locationType === "in_person"
                  ? "Endereço"
                  : locationType === "phone"
                    ? "Telefone (opcional)"
                    : "Link da chamada (opcional)"}
              </Label>
              <Input
                id="locationDetail"
                name="locationDetail"
                defaultValue={eventType?.locationDetail ?? ""}
                className="h-10"
                placeholder={
                  locationType === "in_person"
                    ? "Rua, número, sala, cidade"
                    : locationType === "phone"
                      ? "Você ligará para o convidado"
                      : "https://meet.google.com/..."
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Valor (R$)</Label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                placeholder="Opcional"
                defaultValue={
                  eventType?.priceCents != null
                    ? (eventType.priceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                    : ""
                }
                className="h-10"
              />
              <FieldError message={errors.priceCents} />
              <p className="text-xs text-muted-foreground">
                Sugerido nos recibos. Não é exibido nem cobrado.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regras de agendamento</CardTitle>
            <CardDescription>Controle quando e com que folga as pessoas podem agendar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bufferBeforeMinutes">Intervalo antes (min)</Label>
              <Input
                id="bufferBeforeMinutes"
                name="bufferBeforeMinutes"
                type="number"
                min={0}
                max={240}
                step={5}
                defaultValue={eventType?.bufferBeforeMinutes ?? 0}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bufferAfterMinutes">Intervalo depois (min)</Label>
              <Input
                id="bufferAfterMinutes"
                name="bufferAfterMinutes"
                type="number"
                min={0}
                max={240}
                step={5}
                defaultValue={eventType?.bufferAfterMinutes ?? 0}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label>Antecedência mínima</Label>
              <Select name="minNoticeMinutes" defaultValue={String(eventType?.minNoticeMinutes ?? 240)}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxDaysAhead">Agendável até (dias à frente)</Label>
              <Input
                id="maxDaysAhead"
                name="maxDaysAhead"
                type="number"
                min={1}
                max={365}
                defaultValue={eventType?.maxDaysAhead ?? 60}
                className="h-10"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="grid h-fit gap-4 lg:sticky lg:top-8">
        <Card className="overflow-hidden pt-0">
          <div className="h-1.5" style={{ backgroundColor: color }} />
          <CardHeader>
            <CardDescription>Pré-visualização</CardDescription>
            <CardTitle className="text-lg">{title || "Novo evento"}</CardTitle>
            <CardDescription>
              {formatDuration(Number(duration))}, {LOCATION_LABELS[locationType]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Aceitando agendamentos</p>
                <p className="text-xs text-muted-foreground">Desative para ocultar o link.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </CardContent>
        </Card>
        {state.message && <p className="text-sm text-destructive">{state.message}</p>}
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-10 flex-1">
            <Link href="/app/event-types">Cancelar</Link>
          </Button>
          <Button type="submit" className="h-10 flex-1" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </div>
      </aside>
    </form>
  )
}
