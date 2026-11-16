"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  MapPinIcon,
  MoreVerticalIcon,
  PencilIcon,
  PhoneIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { schema } from "@/db"
import { LOCATION_LABELS } from "@/lib/constants"
import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"
import { deleteEventType, setEventTypeActive } from "@/server/event-types"

const LOCATION_ICONS = { video: VideoIcon, phone: PhoneIcon, in_person: MapPinIcon }

export function EventTypeCard({
  eventType: et,
  username,
}: {
  eventType: typeof schema.eventType.$inferSelect
  username: string
}) {
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const path = `/${username}/${et.slug}`
  const LocationIcon = LOCATION_ICONS[et.locationType]

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md",
        !et.isActive && "opacity-60",
        pending && "pointer-events-none opacity-50",
      )}
    >
      <div className="h-1.5" style={{ backgroundColor: et.color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/app/event-types/${et.id}`}
            className="text-lg leading-snug font-semibold hover:underline"
          >
            {et.title}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Ações" className="-mt-1 -mr-2">
                <MoreVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/app/event-types/${et.id}`}>
                  <PencilIcon /> Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  startTransition(async () => {
                    await setEventTypeActive(et.id, !et.isActive)
                    toast.success(et.isActive ? "Evento desativado" : "Evento ativado")
                  })
                }
              >
                {et.isActive ? <EyeOffIcon /> : <EyeIcon />}
                {et.isActive ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2Icon /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <LocationIcon className="size-3.5" />
          {formatDuration(et.durationMinutes)}, {LOCATION_LABELS[et.locationType]}
        </p>
        {!et.isActive && (
          <Badge variant="secondary" className="mt-2 w-fit">
            Desativado
          </Badge>
        )}
        <Link
          href={path}
          target="_blank"
          className="mt-3 w-fit text-sm font-medium text-primary hover:underline"
        >
          Ver página de agendamento
        </Link>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-primary hover:text-primary"
          onClick={async () => {
            await navigator.clipboard.writeText(`${window.location.origin}${path}`)
            toast.success("Link copiado!")
          }}
        >
          <CopyIcon /> Copiar link
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-full border-primary/40 text-primary hover:text-primary"
        >
          <Link href={`/app/event-types/${et.id}`}>Editar</Link>
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{et.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O link deixará de funcionar e os agendamentos deste tipo serão removidos. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  await deleteEventType(et.id)
                  toast.success("Evento excluído")
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
