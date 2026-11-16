"use client"

import { useState } from "react"
import { ChevronDownIcon, RepeatIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatInTz } from "@/lib/format"
import { cn } from "@/lib/utils"
import { BookingActions, BookingInfo, type BookingView } from "./booking-details"

export function BookingRow({ booking: b, timezone }: { booking: BookingView; timezone: string }) {
  const [open, setOpen] = useState(false)

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: b.eventType.color }} />
        <span className="w-32 shrink-0 text-sm font-medium tabular-nums">
          {formatInTz(b.startsAt, timezone, "HH:mm")} – {formatInTz(b.endsAt, timezone, "HH:mm")}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-semibold", b.status === "cancelled" && "line-through")}>
            {b.contact.name}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            Evento: <strong className="font-medium text-foreground/80">{b.eventType.title}</strong>
          </span>
        </span>
        {b.seriesId && (
          <RepeatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Recorrente" />
        )}
        {b.attendance && (
          <Badge
            variant="outline"
            className={
              b.attendance === "attended"
                ? "border-success text-success"
                : "border-destructive text-destructive"
            }
          >
            {b.attendance === "attended" ? "Compareceu" : "Faltou"}
          </Badge>
        )}
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="grid gap-4 border-t bg-muted/30 px-5 py-4 sm:grid-cols-[1fr_auto] sm:pl-[3.4rem]">
          <BookingInfo booking={b} />
          <div className="sm:self-start">
            <BookingActions booking={b} timezone={timezone} />
          </div>
        </div>
      )}
    </li>
  )
}
