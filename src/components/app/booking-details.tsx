"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
  RepeatIcon,
  UserRoundIcon,
  UserXIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { LOCATION_LABELS } from "@/lib/constants"
import { formatInTz, tzLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import { cancelBookingAsHost, cancelSeriesFrom, setAttendance } from "@/server/bookings"

export type BookingView = {
  id: string
  startsAt: string
  endsAt: string
  status: "confirmed" | "cancelled"
  notes: string | null
  cancelReason: string | null
  inviteeTimezone: string
  attendance: "attended" | "no_show" | null
  seriesId: string | null
  contactId: string
  contact: { name: string; email: string | null; phone: string | null }
  eventType: {
    title: string
    color: string
    locationType: keyof typeof LOCATION_LABELS
    locationDetail: string | null
  }
}

/** Contato, local, fuso e observações de um agendamento. */
export function BookingInfo({ booking: b }: { booking: BookingView }) {
  return (
    <dl className="grid gap-2 text-sm">
      {b.contact.email && (
        <div className="flex items-center gap-2">
          <MailIcon className="size-4 shrink-0 text-muted-foreground" />
          <a href={`mailto:${b.contact.email}`} className="truncate text-primary hover:underline">
            {b.contact.email}
          </a>
        </div>
      )}
      {b.contact.phone && (
        <div className="flex items-center gap-2">
          <PhoneIcon className="size-4 shrink-0 text-muted-foreground" /> {b.contact.phone}
        </div>
      )}
      <div className="flex items-start gap-2">
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          {LOCATION_LABELS[b.eventType.locationType]}
          {b.eventType.locationDetail && `: ${b.eventType.locationDetail}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <GlobeIcon className="size-4 shrink-0 text-muted-foreground" /> Fuso do convidado:{" "}
        {tzLabel(b.inviteeTimezone)}
      </div>
      {b.notes && (
        <div className="flex items-start gap-2">
          <MessageSquareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="whitespace-pre-wrap">{b.notes}</p>
        </div>
      )}
      {b.seriesId && (
        <div className="flex items-center gap-2">
          <RepeatIcon className="size-4 shrink-0 text-muted-foreground" /> Faz parte de uma série recorrente
        </div>
      )}
      {b.cancelReason && <p className="text-destructive">Motivo do cancelamento: {b.cancelReason}</p>}
      <Link
        href={`/app/contacts/${b.contactId}`}
        className="mt-1 flex w-fit items-center gap-1.5 font-semibold text-primary hover:underline"
      >
        <UserRoundIcon className="size-4" /> Abrir ficha
      </Link>
    </dl>
  )
}

/**
 * Ações do agendamento: presença (passados) ou cancelamento (futuros),
 * incluindo "esta e as próximas" para séries recorrentes.
 */
export function BookingActions({
  booking: b,
  timezone,
  onChanged,
}: {
  booking: BookingView
  timezone: string
  onChanged?: () => void
}) {
  const router = useRouter()
  const [attendance, setLocalAttendance] = useState(b.attendance)
  const [cancelScope, setCancelScope] = useState<"one" | "series" | null>(null)
  const [pending, startTransition] = useTransition()
  if (b.status !== "confirmed") return null
  const isPast = new Date(b.startsAt) <= new Date()

  if (isPast) {
    const mark = (value: "attended" | "no_show") =>
      startTransition(async () => {
        const next = attendance === value ? null : value
        const res = await setAttendance(b.id, next)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setLocalAttendance(next)
        router.refresh()
      })
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Presença:</span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-pressed={attendance === "attended"}
          className={cn(
            "rounded-full",
            attendance === "attended" && "border-success bg-success/10 text-success hover:bg-success/15",
          )}
          onClick={() => mark("attended")}
        >
          <CheckIcon /> Compareceu
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-pressed={attendance === "no_show"}
          className={cn(
            "rounded-full",
            attendance === "no_show" &&
              "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/15",
          )}
          onClick={() => mark("no_show")}
        >
          <UserXIcon /> Faltou
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setCancelScope("one")}>
        Cancelar agendamento
      </Button>
      {b.seriesId && (
        <Button variant="ghost" onClick={() => setCancelScope("series")}>
          Cancelar esta e as próximas
        </Button>
      )}
      <CancelBookingDialog
        booking={b}
        timezone={timezone}
        scope={cancelScope ?? "one"}
        open={cancelScope !== null}
        onOpenChange={(o) => !o && setCancelScope(null)}
        onCancelled={onChanged}
      />
    </div>
  )
}

/** Diálogo de confirmação de cancelamento pelo profissional. */
export function CancelBookingDialog({
  booking: b,
  timezone,
  scope = "one",
  open,
  onOpenChange,
  onCancelled,
}: {
  booking: BookingView
  timezone: string
  scope?: "one" | "series"
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancelled?: () => void
}) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{scope === "series" ? "Cancelar série" : "Cancelar agendamento"}</DialogTitle>
          <DialogDescription>
            {b.eventType.title} com {b.contact.name}, {formatInTz(b.startsAt, timezone, "d 'de' MMMM, HH:mm")}
            {scope === "series" ? ", e todas as ocorrências seguintes." : "."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Motivo (opcional), será exibido ao convidado"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (scope === "series") {
                  const res = await cancelSeriesFrom(b.id, reason)
                  if (!res.ok) {
                    toast.error(res.error)
                    return
                  }
                  toast.success(`${res.count} agendamentos cancelados`)
                } else {
                  await cancelBookingAsHost(b.id, reason)
                  toast.success("Agendamento cancelado")
                }
                onOpenChange(false)
                onCancelled?.()
                router.refresh()
              })
            }
          >
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
