"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { disconnectGoogleCalendar, updateGoogleCalendarPrefs } from "@/server/integrations"

export type GoogleConnectionView = {
  accountEmail: string
  pushBookings: boolean
  blockBusy: boolean
  lastError: string | null
  syncedUpcoming: number
}

/** Logo do Google Calendar simplificado (marca de terceiro, só para identificação). */
function GoogleCalendarMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-11 shrink-0" aria-hidden>
      <rect x="6" y="6" width="36" height="36" rx="6" fill="#fff" stroke="#dadce0" />
      <rect x="6" y="6" width="36" height="9" rx="4" fill="#4285f4" />
      <text
        x="24"
        y="36"
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill="#4285f4"
        fontFamily="Arial"
      >
        31
      </text>
    </svg>
  )
}

export function GoogleCalendarCard({
  configured,
  connection,
}: {
  configured: boolean
  connection: GoogleConnectionView | null
}) {
  const router = useRouter()
  const [prefs, setPrefs] = useState({
    pushBookings: connection?.pushBookings ?? true,
    blockBusy: connection?.blockBusy ?? true,
  })
  const [pending, startTransition] = useTransition()

  function save(next: typeof prefs) {
    setPrefs(next)
    startTransition(async () => {
      const res = await updateGoogleCalendarPrefs(next)
      if (!res.ok) {
        toast.error(res.error)
        setPrefs(prefs)
      } else {
        toast.success("Preferência salva")
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-[13px] border bg-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <GoogleCalendarMark />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-primary dark:text-foreground">Google Calendar</h2>
            {connection && !connection.lastError && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok-50 px-2 py-0.5 text-xs font-semibold text-ok">
                <CheckCircle2Icon className="size-3.5" /> Conectado
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {connection
              ? `Conta ${connection.accountEmail}`
              : "Seus agendamentos aparecem na sua agenda do Google, e seus compromissos pessoais deixam de ser oferecidos aos pacientes."}
          </p>
        </div>
        {connection ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Desconectar</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar o Google Calendar?</AlertDialogTitle>
                <AlertDialogDescription>
                  Novos agendamentos deixam de ir para o Google e seus compromissos de lá não bloqueiam mais
                  horários. Os eventos já criados continuam na sua agenda do Google.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    startTransition(async () => {
                      await disconnectGoogleCalendar()
                      toast.success("Google Calendar desconectado")
                      router.refresh()
                    })
                  }
                >
                  Desconectar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : configured ? (
          <Button asChild>
            {/* Navegação completa: a rota redireciona para o Google (fora do app). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/integrations/google/connect">Conectar</a>
          </Button>
        ) : null}
      </div>

      {!configured && (
        <p className="mx-5 mb-5 flex items-start gap-2 rounded-[9px] bg-warn-50 px-3 py-2.5 text-[13px] text-warn">
          <AlertTriangleIcon className="mt-px size-4 shrink-0" />
          <span>
            A integração ainda não foi ativada neste servidor. Defina <code>GOOGLE_CLIENT_ID</code> e{" "}
            <code>GOOGLE_CLIENT_SECRET</code> (veja o README).
          </span>
        </p>
      )}

      {connection?.lastError && (
        <p className="mx-5 mb-5 flex items-start gap-2 rounded-[9px] bg-warm-50 px-3 py-2.5 text-[13px] text-warm-foreground">
          <AlertTriangleIcon className="mt-px size-4 shrink-0" />
          <span>{connection.lastError}</span>
        </p>
      )}

      {connection && (
        <div className="divide-y border-t">
          <PrefRow
            title="Enviar agendamentos para o Google"
            hint={`Cria, atualiza e remove eventos na sua agenda principal. ${
              connection.syncedUpcoming === 1
                ? "1 agendamento futuro já está lá."
                : `${connection.syncedUpcoming} agendamentos futuros já estão lá.`
            }`}
            checked={prefs.pushBookings}
            disabled={pending}
            onChange={(v) => save({ ...prefs, pushBookings: v })}
          />
          <PrefRow
            title="Bloquear horários ocupados no Google"
            hint="Compromissos da sua agenda do Google não aparecem como horários livres na página pública. O Nautly vê só o horário, não o conteúdo."
            checked={prefs.blockBusy}
            disabled={pending}
            onChange={(v) => save({ ...prefs, blockBusy: v })}
          />
        </div>
      )}
    </section>
  )
}

function PrefRow({
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  title: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4">
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  )
}
