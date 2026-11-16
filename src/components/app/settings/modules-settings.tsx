"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"
import { LockIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { setModuleEnabled } from "@/server/settings"

type ModuleItem = { id: string; label: string; description: string; clinical: boolean; comingSoon: boolean }

export function ModulesSettings({
  verticalLabel,
  modules,
  enabled,
}: {
  verticalLabel: string
  modules: ModuleItem[]
  enabled: string[]
}) {
  const [, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(
    enabled,
    (state, { id, on }: { id: string; on: boolean }) => (on ? [...state, id] : state.filter((m) => m !== id)),
  )

  const available = modules.filter((m) => !m.comingSoon)
  const soon = modules.filter((m) => m.comingSoon)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recursos</CardTitle>
        <CardDescription>
          Recursos pensados para {verticalLabel}. Os desligados não aparecem no painel.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {available.map((m) => {
          const on = optimistic.includes(m.id)
          return (
            <div key={m.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  {m.label}
                  {m.clinical && (
                    <Badge variant="secondary" className="gap-1">
                      <LockIcon className="size-3" /> Dado sensível
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{m.description}</p>
              </div>
              <Switch
                checked={on}
                aria-label={m.label}
                onCheckedChange={(value) =>
                  startTransition(async () => {
                    setOptimistic({ id: m.id, on: value })
                    const res = await setModuleEnabled(m.id, value)
                    if (!res.ok) toast.error(res.error)
                  })
                }
              />
            </div>
          )
        })}

        {soon.length > 0 && (
          <>
            <p className="mt-4 text-sm font-semibold text-muted-foreground">Em breve</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {soon.map((m) => (
                <div key={m.id} className={cn("rounded-lg border border-dashed p-4 opacity-80")}>
                  <p className="font-semibold">{m.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.description}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
