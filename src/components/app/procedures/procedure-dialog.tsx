"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { saveProcedure } from "@/server/procedures"

export type ProcedureDraft = { id?: string; name: string; price: string; effect: string; perTooth: boolean }

export const NO_EFFECT = "none"

/** Criar ou editar um procedimento (nome, preço e, na odontologia, dente e efeito). */
export function ProcedureDialog({
  draft,
  setDraft,
  dental,
}: {
  draft: ProcedureDraft | null
  setDraft: (d: ProcedureDraft | null) => void
  dental: boolean
}) {
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    startTransition(async () => {
      const res = await saveProcedure({
        ...draft,
        effect: draft.effect === NO_EFFECT ? undefined : draft.effect,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(draft.id ? "Procedimento atualizado" : "Procedimento criado")
      setDraft(null)
    })
  }

  return (
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
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
