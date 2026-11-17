"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2Icon, RepeatIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDuration } from "@/lib/format"
import { REPEAT_LABELS, type Repeat } from "@/lib/scheduling/recurrence"
import { createManualBooking } from "@/server/bookings"

type Option = { id: string; name: string }
type EventOption = { id: string; title: string; durationMinutes: number; color: string }

export function NewBookingDialog({
  contact,
  contacts,
  eventTypes,
  recurringEnabled,
  defaultDate,
  clientNoun,
  children,
}: {
  /** Cadastro fixo (na ficha) ou lista para escolher (na agenda). */
  contact?: Option
  contacts?: Option[]
  eventTypes: EventOption[]
  recurringEnabled: boolean
  defaultDate: string
  clientNoun: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [contactId, setContactId] = useState(contact?.id ?? "")
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? "")
  const [repeat, setRepeat] = useState<Repeat>("none")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!contactId || !eventTypeId) {
      setError(`Escolha o ${clientNoun} e o serviço.`)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createManualBooking({
        contactId,
        eventTypeId,
        date: String(form.get("date")),
        time: String(form.get("time")),
        repeat,
        count: Number(form.get("count") ?? 8),
        notes: String(form.get("notes") ?? ""),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      setRepeat("none")
      toast.success(res.created === 1 ? "Agendamento criado" : `${res.created} agendamentos criados`, {
        description: res.skipped.length
          ? `Pulamos ${res.skipped.join(", ")} por conflito de horário.`
          : undefined,
      })
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            {contact
              ? `Agende um horário para ${contact.name}.`
              : "Encaixe um horário direto na agenda, mesmo fora da disponibilidade pública."}
          </DialogDescription>
        </DialogHeader>

        {eventTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crie um serviço antes de agendar.</p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            {!contact && (
              <div className="grid gap-2 sm:col-span-2">
                <Label>Para quem</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder={`Escolha o ${clientNoun}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(contacts ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2 sm:col-span-2">
              <Label>Serviço</Label>
              <Select value={eventTypeId} onValueChange={setEventTypeId}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((et) => (
                    <SelectItem key={et.id} value={et.id}>
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: et.color }} />
                      {et.title} · {formatDuration(et.durationMinutes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nb-date">Data</Label>
              <Input
                id="nb-date"
                name="date"
                type="date"
                required
                defaultValue={defaultDate}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nb-time">Horário</Label>
              <Input id="nb-time" name="time" type="time" required defaultValue="09:00" className="h-10" />
            </div>
            {recurringEnabled && (
              <>
                <div className="grid gap-2">
                  <Label>
                    <RepeatIcon className="size-3.5" /> Repetir
                  </Label>
                  <Select value={repeat} onValueChange={(v) => setRepeat(v as Repeat)}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REPEAT_LABELS) as Repeat[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {REPEAT_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {repeat !== "none" && (
                  <div className="grid gap-2">
                    <Label htmlFor="nb-count">Quantas vezes</Label>
                    <Input
                      id="nb-count"
                      name="count"
                      type="number"
                      min={2}
                      max={52}
                      defaultValue={8}
                      className="h-10"
                    />
                  </div>
                )}
              </>
            )}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="nb-notes">Observações</Label>
              <Textarea id="nb-notes" name="notes" placeholder="Opcional" />
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />}
                Agendar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
