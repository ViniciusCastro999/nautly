"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ListChecksIcon,
  Loader2Icon,
  PencilIcon,
  PercentIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { PROCEDURE_EFFECTS } from "@/lib/dental"
import { formatBRL } from "@/lib/documents/money"
import { cn } from "@/lib/utils"
import { adjustProcedurePrices, setProcedureActive, updateProcedurePrice } from "@/server/procedures"
import { NO_EFFECT, ProcedureDialog, type ProcedureDraft } from "./procedure-dialog"

export type ProcedureView = {
  id: string
  name: string
  priceCents: number
  effect: string | null
  perTooth: boolean
  isActive: boolean
  /** Em quantos orçamentos o procedimento já foi usado. */
  uses: number
}

const FILTERS = [
  { key: "active", label: "Ativos" },
  { key: "archived", label: "Arquivados" },
  { key: "all", label: "Todos" },
] as const
type Filter = (typeof FILTERS)[number]["key"]

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",")
}

export function ProceduresManager({ procedures, dental }: { procedures: ProcedureView[]; dental: boolean }) {
  const [draft, setDraft] = useState<ProcedureDraft | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("active")

  const visible = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("pt-BR")
    return procedures.filter(
      (p) =>
        (filter === "all" || (filter === "active" ? p.isActive : !p.isActive)) &&
        (!term || p.name.toLocaleLowerCase("pt-BR").includes(term)),
    )
  }, [procedures, q, filter])

  function open(p?: ProcedureView) {
    setDraft(
      p
        ? {
            id: p.id,
            name: p.name,
            price: centsToInput(p.priceCents),
            effect: p.effect ?? NO_EFFECT,
            perTooth: p.perTooth,
          }
        : { name: "", price: "", effect: NO_EFFECT, perTooth: dental },
    )
  }

  const activeCount = procedures.filter((p) => p.isActive).length

  return (
    <>
      <div className="mb-[17px] flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Os preços sugeridos na criação da conta são só um ponto de partida. Ajuste à realidade do seu
          consultório.
        </p>
        <div className="flex flex-wrap gap-2">
          <AdjustPricesDialog activeCount={activeCount} />
          <Button size="lg" onClick={() => open()}>
            <PlusIcon /> Novo procedimento
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[13px] border bg-card">
        <div className="flex flex-col gap-3 border-b p-[15px] sm:flex-row sm:items-center sm:justify-between">
          <label className="flex h-[39px] w-full items-center gap-2.5 rounded-[9px] border bg-muted px-3 text-muted-foreground focus-within:border-ring focus-within:bg-card sm:max-w-[290px]">
            <SearchIcon className="size-4 shrink-0" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar procedimento..."
              aria-label="Buscar procedimento"
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="inline-flex w-fit rounded-[10px] border bg-card p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  filter === f.key
                    ? "bg-sea-50 text-primary dark:text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <span className="mb-3 grid size-11 place-items-center rounded-[10px] bg-sea-50 text-sea">
              <ListChecksIcon className="size-5" />
            </span>
            <p className="font-semibold">
              {q ? `Nenhum procedimento encontrado para “${q}”` : "Nenhum procedimento por aqui"}
            </p>
            {!q && filter === "active" && (
              <Button variant="outline" className="mt-3" onClick={() => open()}>
                <PlusIcon /> Cadastrar o primeiro
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="px-[19px] py-3 font-semibold">Procedimento</th>
                  {dental && <th className="hidden px-4 py-3 font-semibold lg:table-cell">No odontograma</th>}
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Uso</th>
                  <th className="px-4 py-3 text-right font-semibold">Preço</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <Row key={p.id} p={p} dental={dental} onEdit={() => open(p)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProcedureDialog draft={draft} setDraft={setDraft} dental={dental} />
    </>
  )
}

function Row({ p, dental, onEdit }: { p: ProcedureView; dental: boolean; onEdit: () => void }) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(centsToInput(p.priceCents))
  const [pending, startTransition] = useTransition()

  function savePrice() {
    if (price === centsToInput(p.priceCents)) return setEditing(false)
    startTransition(async () => {
      const res = await updateProcedurePrice(p.id, price)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`${p.name}: ${formatBRL(res.priceCents)}`)
      setEditing(false)
    })
  }

  function toggleActive() {
    startTransition(async () => {
      await setProcedureActive(p.id, !p.isActive)
      toast.success(p.isActive ? "Procedimento arquivado" : "Procedimento reativado")
    })
  }

  return (
    <tr className={cn("border-t border-line-soft", !p.isActive && "text-muted-foreground")}>
      <td className="px-[19px] py-3">
        <p className="font-semibold">{p.name}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {p.perTooth && dental && <Badge variant="secondary">Por dente</Badge>}
          {!p.isActive && <Badge variant="muted">Arquivado</Badge>}
        </div>
      </td>
      {dental && (
        <td className="hidden px-4 py-3 text-[13px] text-muted-foreground lg:table-cell">
          {p.effect ? PROCEDURE_EFFECTS[p.effect as keyof typeof PROCEDURE_EFFECTS] : "Não altera"}
        </td>
      )}
      <td className="hidden px-4 py-3 text-[13px] text-muted-foreground md:table-cell">
        {p.uses === 0 ? "Ainda não usado" : `${p.uses} ${p.uses === 1 ? "orçamento" : "orçamentos"}`}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              savePrice()
            }}
            className="ml-auto flex w-36 items-center gap-1.5"
          >
            <span className="text-[13px] text-muted-foreground">R$</span>
            <Input
              autoFocus
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={savePrice}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setPrice(centsToInput(p.priceCents))
                  setEditing(false)
                }
              }}
              disabled={pending}
              aria-label={`Preço de ${p.name}`}
              className="h-8 text-right tabular-nums"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPrice(centsToInput(p.priceCents))
              setEditing(true)
            }}
            title="Clique para alterar o preço"
            className="rounded-[7px] px-2 py-1 font-semibold tabular-nums underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 hover:bg-sea-50"
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : formatBRL(p.priceCents)}
          </button>
        )}
      </td>
      <td className="pr-3">
        <div className="flex justify-end gap-0.5">
          <Button size="icon" variant="ghost" aria-label={`Editar ${p.name}`} onClick={onEdit}>
            <PencilIcon />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            aria-label={p.isActive ? `Arquivar ${p.name}` : `Reativar ${p.name}`}
            title={p.isActive ? "Arquivar" : "Reativar"}
            onClick={toggleActive}
          >
            {p.isActive ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
          </Button>
        </div>
      </td>
    </tr>
  )
}

const ROUNDING = [
  { value: "1", label: "Não arredondar" },
  { value: "100", label: "Real inteiro (R$ 1)" },
  { value: "500", label: "Múltiplos de R$ 5" },
  { value: "1000", label: "Múltiplos de R$ 10" },
] as const

function AdjustPricesDialog({ activeCount }: { activeCount: number }) {
  const [open, setOpen] = useState(false)
  const [percent, setPercent] = useState("")
  const [rounding, setRounding] = useState<(typeof ROUNDING)[number]["value"]>("100")
  const [pending, startTransition] = useTransition()
  const value = Number(percent.replace(",", "."))
  const valid = percent.trim() !== "" && Number.isFinite(value) && value !== 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return void toast.error("Informe o percentual, ex.: 10 ou -5")
    startTransition(async () => {
      const res = await adjustProcedurePrices({
        percent: value,
        roundToCents: Number(rounding) as 1 | 100 | 500 | 1000,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(`${res.count} ${res.count === 1 ? "preço reajustado" : "preços reajustados"}`)
      setOpen(false)
      setPercent("")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" disabled={activeCount === 0}>
          <PercentIcon /> Reajustar preços
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Reajustar preços</DialogTitle>
            <DialogDescription>
              Aplica o percentual aos {activeCount} procedimentos ativos. Orçamentos já criados não mudam.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="adj-percent">Percentual (%)</Label>
              <Input
                id="adj-percent"
                inputMode="decimal"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="10 ou -5"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Arredondamento</Label>
              <Select value={rounding} onValueChange={(v) => setRounding(v as typeof rounding)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUNDING.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {valid && (
            <p className="rounded-[9px] bg-sea-50 px-3 py-2 text-[13px] text-primary dark:text-foreground">
              Ex.: {formatBRL(25_000)} passa a{" "}
              {formatBRL(
                Math.max(0, Math.round((25_000 * (1 + value / 100)) / Number(rounding)) * Number(rounding)),
              )}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !valid}>
              {pending && <Loader2Icon className="animate-spin" />}
              Aplicar reajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
