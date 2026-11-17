"use client"

import { useState } from "react"
import { ChevronDownIcon, MapPinIcon, PhoneIcon, RepeatIcon, VideoIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LOCATION_LABELS } from "@/lib/constants"
import { formatInTz, initials } from "@/lib/format"
import { cn } from "@/lib/utils"
import { BookingActions, BookingInfo, type BookingView } from "./booking-details"

const LOCATION_ICONS = { video: VideoIcon, phone: PhoneIcon, in_person: MapPinIcon } as const

/** Etiqueta do formato do atendimento (presencial em verde, remoto em tom quente). */
export function LocationPill({ type }: { type: keyof typeof LOCATION_LABELS }) {
  const Icon = LOCATION_ICONS[type]
  return (
    <Badge variant={type === "in_person" ? "success" : "warm"} className="rounded-[5px] px-1.5">
      <Icon /> {type === "in_person" ? "Presencial" : LOCATION_LABELS[type]}
    </Badge>
  )
}

export function BookingRow({ booking: b, timezone }: { booking: BookingView; timezone: string }) {
  const [open, setOpen] = useState(false)

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[72px] w-full items-center gap-3 px-[15px] py-3 text-left transition-colors hover:bg-muted sm:gap-4 sm:px-[19px]"
      >
        <span className="grid w-11 shrink-0 text-[13px] tabular-nums">
          <b className="font-bold text-primary dark:text-foreground">
            {formatInTz(b.startsAt, timezone, "HH:mm")}
          </b>
          <span className="text-muted-foreground">{formatInTz(b.endsAt, timezone, "HH:mm")}</span>
        </span>
        <span
          className="h-9 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: b.eventType.color }}
          aria-hidden
        />
        <Avatar className="hidden size-[34px] sm:flex">
          <AvatarFallback className="bg-foam/50 text-[13px] font-semibold text-primary dark:bg-sea-50 dark:text-foam">
            {initials(b.contact.name)}
          </AvatarFallback>
        </Avatar>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className={cn("truncate text-sm font-semibold", b.status === "cancelled" && "line-through")}>
            {b.contact.name}
          </span>
          <span className="truncate text-[13px] text-muted-foreground">{b.eventType.title}</span>
        </span>
        {b.seriesId && (
          <RepeatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Recorrente" />
        )}
        {b.attendance ? (
          <Badge variant={b.attendance === "attended" ? "success" : "warm"}>
            {b.attendance === "attended" ? "Compareceu" : "Faltou"}
          </Badge>
        ) : (
          <span className="hidden sm:block">
            <LocationPill type={b.eventType.locationType} />
          </span>
        )}
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-line-soft bg-muted px-5 py-4 sm:grid-cols-[1fr_auto] sm:pl-[7.5rem]">
          <BookingInfo booking={b} />
          <div className="sm:self-start">
            <BookingActions booking={b} timezone={timezone} />
          </div>
        </div>
      )}
    </li>
  )
}
