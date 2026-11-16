"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ArchiveIcon, ArchiveRestoreIcon, Loader2Icon, PencilIcon, PlusIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROCEDURE_EFFECTS } from "@/lib/dental"
import { formatBRL } from "@/lib/documents/money"
import { cn } from "@/lib/utils"
import { saveProcedure, setProcedureActive } from "@/server/procedures"

export type ProcedureView = {
  id: string
  name: string
  priceCents: number
  effect: string | null
  perTooth: boolean
  isActive: boolean
}

type Draft = { id?: string; name: string; price: string; effect: string; perTooth: boolean }

const NO_EFFECT = "none"

export function ProceduresSettings({
  procedures,
  dental,
}: {
  procedures: ProcedureView[]
  /** Mostra dente e efeito no odontograma. */
  dental: boolean
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()
  const [showArchived, setShowArchived] = useState(false)

  const visible = procedures.filter((p) => showArchived || p.isActive)
  const archivedCount = procedures.filter((p) => !p.isActive).length

  function open(p?: ProcedureView) {
    setDraft(
      p
        ? {
            id: p.id,
            name: p.name,
            price: (p.priceCents / 100).toFixed(2).replace(".", ","),
            effect: p.effect ?? NO_EFFECT,
            perTooth: p.perTooth,
          }
        : { name: "", price: "", effect: NO_EFFECT, perTooth: dental },
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    startTransition(async () => {
      const res = await saveProcedure({
        ...draft,
        effect: draft.effect === NO_EFFECT ? undefined : draft.effect,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(draft.id ? "Procedimento atualizado" : "Procedimento criado")
      setDraft(null)
    })
  }

  function toggleActive(p: ProcedureView) {
    startTransition(async () => {
      await setProcedureActive(p.id, !p.isActive)
      toast.success(p.isActive ? "Procedimento arquivado" : "Procedimento reativado")
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle>Procedimentos e preços</CardTitle>
          <CardDescription>Catálogo usado para montar orçamentos e planos de tratamento.</CardDescription>
        </div>
        <Button size="sm" className="rounded-full" onClick={() => open()}>
          <PlusIcon /> Novo procedimento
        </Button>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum procedimento cadastrado.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {visible.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3",
                  !p.isActive && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {p.perTooth && dental && <Badge variant="secondary">Por dente</Badge>}
                    {p.effect && dental && (
                      <Badge variant="outline">
                        {PROCEDURE_EFFECTS[p.effect as keyof typeof PROCEDURE_EFFECTS]}
                      </Badge>
                    )}
                    {!p.isActive && <Badge variant="outline">Arquivado</Badge>}
                  </div>
                </div>
                <span className="font-semibold tabular-nums">{formatBRL(p.priceCents)}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => open(p)}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    aria-label={p.isActive ? `Arquivar ${p.name}` : `Reativar ${p.name}`}
                    onClick={() => toggleActive(p)}
                  >
                    {p.isActive ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            {showArchived ? "Ocultar arquivados" : `Mostrar arquivados (${archivedCount})`}
          </button>
        )}
      </CardContent>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{draft?.id ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
              <DialogDescription>Alterar o preço não muda orçamentos já criados.</DialogDescription>
            </DialogHeader>
            {draft && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="proc-name">Nome</Label>
                  <Input
                    id="proc-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ex.: Restauração em resina"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="proc-price">Preço (R$)</Label>
                  <Input
                    id="proc-price"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                    placeholder="250,00"
                    required
                  />
                </div>
                {dental && (
                  <>
                    <Label className="flex items-center gap-2 font-normal">
                      <Checkbox
                        checked={draft.perTooth}
                        onCheckedChange={(v) =>
                          setDraft({
                            ...draft,
                            perTooth: v === true,
                            effect: v === true ? draft.effect : NO_EFFECT,
                          })
                        }
                      />
                      Procedimento por dente
                    </Label>
                    {draft.perTooth && (
                      <div className="grid gap-2">
                        <Label>Ao concluir, no odontograma</Label>
                        <Select value={draft.effect} onValueChange={(v) => setDraft({ ...draft, effect: v })}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_EFFECT}>Não altera o odontograma</SelectItem>
                            {Object.entries(PROCEDURE_EFFECTS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-full" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
