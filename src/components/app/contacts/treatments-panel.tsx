"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CopyIcon,
  FileDownIcon,
  Loader2Icon,
  MessageCircleIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { isValidTooth } from "@/lib/dental"
import { formatBRL } from "@/lib/documents/money"
import { canEditItems, canExecute, PLAN_STATUS, planTotals, type PlanStatus } from "@/lib/treatment"
import { cn } from "@/lib/utils"
import {
  addItem,
  approveInPerson,
  createPlan,
  deletePlan,
  presentPlan,
  removeItem,
  reopenPlan,
  setItemDone,
  updatePlanDetails,
} from "@/server/treatment-plans"

export type ProcedureOption = {
  id: string
  name: string
  priceCents: number
  perTooth: boolean
  needsSurfaces: boolean
}

export type PlanView = {
  id: string
  title: string
  status: PlanStatus
  discountCents: number
  notes: string | null
  validUntil: string | null
  validUntilLabel: string | null
  token: string
  createdAt: string
  approvedLabel: string | null
  items: {
    id: string
    description: string
    tooth: number | null
    surfaces: string | null
    priceCents: number
    doneLabel: string | null
  }[]
}

const TONE: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  danger: "bg-destructive/10 text-destructive",
}

function publicUrl(token: string) {
  return `${window.location.origin}/orcamento/${token}`
}

export function TreatmentsPanel({
  contactId,
  contactName,
  contactPhone,
  canWrite,
  dental,
  initialTooth,
  procedures,
  plans,
}: {
  contactId: string
  contactName: string
  contactPhone: string | null
  canWrite: boolean
  dental: boolean
  initialTooth: number | null
  procedures: ProcedureOption[]
  plans: PlanView[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(
    initialTooth !== null && plans.every((p) => !canEditItems(p.status)),
  )
  const [title, setTitle] = useState("Plano de tratamento")

  function create(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createPlan({ contactId, title })
      if (!res.ok) return void toast.error(res.error)
      setCreating(false)
      router.refresh()
    })
  }

  const editableId = plans.find((p) => canEditItems(p.status))?.id

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[13px] border bg-card p-5">
        <div className="flex items-start gap-3">
          <ClipboardCheckIcon className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Planos de tratamento e orçamentos</h2>
            <p className="text-sm text-muted-foreground">
              Monte o orçamento, envie o link para aprovação e acompanhe a execução.
            </p>
          </div>
        </div>
        {canWrite && !creating && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> Novo plano
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="flex flex-wrap items-end gap-3 rounded-[13px] border bg-card p-5">
          <div className="grid min-w-60 flex-1 gap-2">
            <Label htmlFor="plan-title">Título do plano</Label>
            <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <Button type="button" variant="outline" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Criar plano
          </Button>
        </form>
      )}

      {plans.length === 0 && !creating && (
        <p className="rounded-[13px] border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum plano de tratamento ainda.
        </p>
      )}

      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          canWrite={canWrite}
          dental={dental}
          procedures={procedures}
          contactName={contactName}
          contactPhone={contactPhone}
          initialTooth={plan.id === editableId ? initialTooth : null}
        />
      ))}
    </div>
  )
}

function PlanCard({
  plan,
  canWrite,
  dental,
  procedures,
  contactName,
  contactPhone,
  initialTooth,
}: {
  plan: PlanView
  canWrite: boolean
  dental: boolean
  procedures: ProcedureOption[]
  contactName: string
  contactPhone: string | null
  initialTooth: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const editable = canWrite && canEditItems(plan.status)
  const executable = canWrite && canExecute(plan.status)
  const totals = planTotals(
    plan.items.map((i) => ({ priceCents: i.priceCents, done: Boolean(i.doneLabel) })),
    plan.discountCents,
  )
  const status = PLAN_STATUS[plan.status]

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const res = await action()
      if (!res.ok) return void toast.error(res.error ?? "Não foi possível concluir.")
      if (success) toast.success(success)
      router.refresh()
    })
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl(plan.token))
    toast.success("Link copiado")
  }

  function whatsapp() {
    const digits = (contactPhone ?? "").replace(/\D/g, "")
    const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
    const text = `Olá, ${contactName.split(" ")[0]}! Segue o orçamento do seu tratamento para você conferir e aprovar: ${publicUrl(plan.token)}`
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener")
  }

  return (
    <section className="overflow-hidden rounded-[13px] border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{plan.title}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", TONE[status.tone])}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Criado em {plan.createdAt}
            {plan.validUntilLabel && ` · válido até ${plan.validUntilLabel}`}
            {plan.approvedLabel && ` · ${plan.approvedLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {editable && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon /> Detalhes
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/treatment-plans/${plan.id}/pdf`} target="_blank" rel="noopener">
              <FileDownIcon /> PDF
            </a>
          </Button>
        </div>
      </div>

      {plan.items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum procedimento adicionado.</p>
      ) : (
        <ul className="divide-y">
          {plan.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              {executable ? (
                <Checkbox
                  checked={Boolean(item.doneLabel)}
                  disabled={pending}
                  aria-label={`Marcar ${item.description} como realizado`}
                  onCheckedChange={(v) =>
                    startTransition(async () => {
                      const res = await setItemDone(item.id, v === true)
                      if (!res.ok) return void toast.error(res.error)
                      if (res.toothUpdated) toast.success(`Odontograma do dente ${item.tooth} atualizado`)
                      router.refresh()
                    })
                  }
                />
              ) : (
                canExecute(plan.status) && (
                  <CheckCircle2Icon
                    className={cn("size-4", item.doneLabel ? "text-emerald-600" : "text-muted-foreground/40")}
                  />
                )
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", item.doneLabel && "text-muted-foreground line-through")}>
                  {item.description}
                </p>
                {(item.tooth || item.doneLabel) && (
                  <p className="text-xs text-muted-foreground">
                    {item.tooth && `Dente ${item.tooth}${item.surfaces ? ` · faces ${item.surfaces}` : ""}`}
                    {item.tooth && item.doneLabel && " · "}
                    {item.doneLabel && `Realizado ${item.doneLabel}`}
                  </p>
                )}
              </div>
              <span className="font-semibold tabular-nums">{formatBRL(item.priceCents)}</span>
              {editable && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={pending}
                  aria-label={`Remover ${item.description}`}
                  onClick={() => run(() => removeItem(item.id))}
                >
                  <Trash2Icon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <AddItemForm planId={plan.id} dental={dental} procedures={procedures} initialTooth={initialTooth} />
      )}

      <div className="grid gap-3 border-t bg-muted/30 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          {canExecute(plan.status) && (
            <div className="max-w-sm">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {totals.doneCount} de {totals.count} realizados
                </span>
                <span>{totals.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${totals.progress}%` }}
                />
              </div>
            </div>
          )}
          {plan.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{plan.notes}</p>}
        </div>
        <dl className="grid min-w-52 gap-1 text-sm">
          {totals.discount > 0 && (
            <>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatBRL(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Desconto</dt>
                <dd className="tabular-nums">- {formatBRL(totals.discount)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-6 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatBRL(totals.total)}</dd>
          </div>
        </dl>
      </div>

      {canWrite && (
        <div className="flex flex-wrap gap-2 border-t px-5 py-3">
          {(plan.status === "draft" || plan.status === "rejected") && (
            <Button
              size="sm"
              className="rounded-full"
              disabled={pending || plan.items.length === 0}
              onClick={() => run(() => presentPlan(plan.id), "Plano enviado para aprovação")}
            >
              <SendIcon /> Enviar para aprovação
            </Button>
          )}
          {plan.status === "presented" && (
            <>
              <Button size="sm" onClick={copyLink}>
                <CopyIcon /> Copiar link
              </Button>
              {contactPhone && (
                <Button size="sm" variant="outline" onClick={whatsapp}>
                  <MessageCircleIcon /> WhatsApp
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={pending}
                onClick={() => run(() => approveInPerson(plan.id), "Aprovação registrada")}
              >
                <CheckCircle2Icon /> Aprovado no consultório
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                disabled={pending}
                onClick={() => run(() => reopenPlan(plan.id))}
              >
                <Undo2Icon /> Voltar para rascunho
              </Button>
            </>
          )}
          {plan.status !== "approved" && plan.status !== "completed" && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto rounded-full text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => {
                if (confirm("Excluir este plano? Esta ação não pode ser desfeita.")) {
                  run(() => deletePlan(plan.id), "Plano excluído")
                }
              }}
            >
              <Trash2Icon /> Excluir
            </Button>
          )}
        </div>
      )}

      <PlanDetailsDialog plan={plan} open={editing} onOpenChange={setEditing} />
    </section>
  )
}

function AddItemForm({
  planId,
  dental,
  procedures,
  initialTooth,
}: {
  planId: string
  dental: boolean
  procedures: ProcedureOption[]
  initialTooth: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [procedureId, setProcedureId] = useState("")
  const [description, setDescription] = useState("")
  const [tooth, setTooth] = useState(initialTooth ? String(initialTooth) : "")
  const [surfaces, setSurfaces] = useState("")
  const [price, setPrice] = useState("")
  const proc = procedures.find((p) => p.id === procedureId)
  const custom = procedureId === "custom"

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const toothNumber = tooth ? Number(tooth) : null
    if (toothNumber !== null && !isValidTooth(toothNumber))
      return void toast.error("Dente inválido (use a numeração FDI).")
    startTransition(async () => {
      const res = await addItem({
        planId,
        procedureId: custom ? undefined : procedureId || undefined,
        description: custom ? description : undefined,
        tooth: toothNumber,
        surfaces,
        price,
      })
      if (!res.ok) return void toast.error(res.error)
      setProcedureId("")
      setDescription("")
      setTooth("")
      setSurfaces("")
      setPrice("")
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t px-5 py-4">
      <div className="grid min-w-56 flex-1 gap-1.5">
        <Label className="text-xs">Procedimento</Label>
        <Select
          value={procedureId}
          onValueChange={(v) => {
            setProcedureId(v)
            const p = procedures.find((x) => x.id === v)
            setPrice(p ? (p.priceCents / 100).toFixed(2).replace(".", ",") : "")
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Escolha do catálogo" />
          </SelectTrigger>
          <SelectContent>
            {procedures.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {formatBRL(p.priceCents)}
              </SelectItem>
            ))}
            <SelectItem value="custom">Outro (descrever)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {custom && (
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Label htmlFor={`desc-${planId}`} className="text-xs">
            Descrição
          </Label>
          <Input
            id={`desc-${planId}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
      )}
      {dental && (custom || proc?.perTooth) && (
        <div className="grid w-20 gap-1.5">
          <Label htmlFor={`tooth-${planId}`} className="text-xs">
            Dente
          </Label>
          <Input
            id={`tooth-${planId}`}
            inputMode="numeric"
            value={tooth}
            onChange={(e) => setTooth(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="36"
            required={!custom}
          />
        </div>
      )}
      {dental && (custom || proc?.needsSurfaces) && (
        <div className="grid w-24 gap-1.5">
          <Label htmlFor={`surf-${planId}`} className="text-xs">
            Faces
          </Label>
          <Input
            id={`surf-${planId}`}
            value={surfaces}
            onChange={(e) =>
              setSurfaces(
                e.target.value
                  .toUpperCase()
                  .replace(/[^OMDVL]/g, "")
                  .slice(0, 5),
              )
            }
            placeholder="MO"
            required={proc?.needsSurfaces}
          />
        </div>
      )}
      <div className="grid w-28 gap-1.5">
        <Label htmlFor={`price-${planId}`} className="text-xs">
          Valor (R$)
        </Label>
        <Input
          id={`price-${planId}`}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0,00"
          required={custom}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={pending || !procedureId}>
        {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        Adicionar
      </Button>
    </form>
  )
}

function PlanDetailsDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: PlanView
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updatePlanDetails({
        planId: plan.id,
        title: String(form.get("title") ?? ""),
        discount: String(form.get("discount") ?? ""),
        validUntil: String(form.get("validUntil") ?? ""),
        notes: String(form.get("notes") ?? ""),
      })
      if (!res.ok) return void toast.error(res.error)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Detalhes do plano</DialogTitle>
            <DialogDescription>Aparecem no orçamento enviado ao paciente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="pd-title">Título</Label>
            <Input id="pd-title" name="title" defaultValue={plan.title} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pd-discount">Desconto (R$)</Label>
              <Input
                id="pd-discount"
                name="discount"
                inputMode="decimal"
                defaultValue={
                  plan.discountCents ? (plan.discountCents / 100).toFixed(2).replace(".", ",") : ""
                }
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pd-valid">Válido até</Label>
              <Input id="pd-valid" name="validUntil" type="date" defaultValue={plan.validUntil ?? ""} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pd-notes">Observações e condições de pagamento</Label>
            <Textarea
              id="pd-notes"
              name="notes"
              defaultValue={plan.notes ?? ""}
              placeholder="Ex.: pagamento em até 6x no cartão"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
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
