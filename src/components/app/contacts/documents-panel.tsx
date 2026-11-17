"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  AlertTriangleIcon,
  FileCheckIcon,
  FileTextIcon,
  Loader2Icon,
  PillIcon,
  PlusIcon,
  ReceiptIcon,
  StethoscopeIcon,
  XIcon,
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DOCUMENT_LABELS, PRESCRIPTION_USAGES, type DocumentKind } from "@/lib/documents/kinds"
import { formatBRL, parseBRL } from "@/lib/documents/money"
import { issueDocument } from "@/server/documents"

export type DocumentView = {
  id: string
  kind: DocumentKind
  number: number
  createdAt: string
  summary: string
}

export type BillableBooking = { id: string; label: string; priceCents: number | null }

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência bancária"]

function opened(id: string, number: number, router: ReturnType<typeof useRouter>) {
  toast.success(`Documento nº ${String(number).padStart(4, "0")} emitido`, {
    action: { label: "Abrir PDF", onClick: () => window.open(`/api/documents/${id}`, "_blank", "noopener") },
  })
  router.refresh()
}

export function DocumentsPanel({
  contactId,
  canWrite,
  documents,
  bookings,
  profileIncomplete,
  clinicalDocs,
}: {
  contactId: string
  canWrite: boolean
  documents: DocumentView[]
  bookings: BillableBooking[]
  profileIncomplete: boolean
  /** Atestado e receituário (medicina e odontologia). */
  clinicalDocs: boolean
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[13px] border bg-card p-5">
        <div>
          <h2 className="font-semibold">{clinicalDocs ? "Documentos" : "Recibos e declarações"}</h2>
          <p className="text-sm text-muted-foreground">
            {clinicalDocs
              ? "Recibos, declarações, atestados e receitas em PDF numerado."
              : "PDFs numerados, prontos para reembolso do plano de saúde ou para o trabalho."}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <ReceiptDialog contactId={contactId} bookings={bookings} />
            <AttendanceDialog contactId={contactId} bookings={bookings} />
            {clinicalDocs && (
              <>
                <CertificateDialog contactId={contactId} bookings={bookings} />
                <PrescriptionDialog contactId={contactId} />
              </>
            )}
          </div>
        )}
      </div>

      {profileIncomplete && canWrite && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            Recibos para reembolso precisam do seu CPF ou CNPJ e do endereço do consultório.{" "}
            <Link href="/app/settings/profile" className="font-semibold text-primary hover:underline">
              Completar em Configurações
            </Link>
          </span>
        </p>
      )}

      {documents.length === 0 ? (
        <p className="rounded-[13px] border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum documento emitido.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-[13px] border bg-card">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-4 px-5 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <DocIcon kind={d.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {DOCUMENT_LABELS[d.kind]} nº {String(d.number).padStart(4, "0")}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {d.createdAt} · {d.summary}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener">
                  <FileTextIcon /> Abrir PDF
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReceiptDialog({ contactId, bookings }: { contactId: string; bookings: BillableBooking[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [amount, setAmount] = useState<string | null>(null)
  const [method, setMethod] = useState(PAYMENT_METHODS[0])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Enquanto o valor não for editado, sugere a soma dos preços dos atendimentos marcados.
  const suggested = bookings
    .filter((b) => selected.includes(b.id))
    .reduce((sum, b) => sum + (b.priceCents ?? 0), 0)
  const shownAmount = amount ?? (suggested ? formatBRL(suggested).replace(/^R\$\s?/, "") : "")

  function submit() {
    const cents = parseBRL(shownAmount)
    if (!cents) {
      setError("Informe um valor válido, ex.: 250,00")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await issueDocument({
        kind: "receipt",
        contactId,
        bookingIds: selected,
        totalCents: cents,
        paymentMethod: method,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      setSelected([])
      setAmount(null)
      opened(res.id, res.number, router)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ReceiptIcon /> Emitir recibo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir recibo</DialogTitle>
          <DialogDescription>Escolha os atendimentos pagos. Faltas não aparecem aqui.</DialogDescription>
        </DialogHeader>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atendimento realizado ainda.</p>
        ) : (
          <div className="grid gap-4">
            <div className="max-h-56 overflow-y-auto rounded-lg border">
              {bookings.map((b) => (
                <label
                  key={b.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selected.includes(b.id)}
                    onCheckedChange={(c) =>
                      setSelected((s) => (c ? [...s, b.id] : s.filter((x) => x !== b.id)))
                    }
                  />
                  <span className="flex-1">{b.label}</span>
                  {b.priceCents !== null && (
                    <span className="text-muted-foreground tabular-nums">{formatBRL(b.priceCents)}</span>
                  )}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="r-amount">Valor total (R$)</Label>
                <Input
                  id="r-amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={shownAmount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label>Pagamento</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={pending || selected.length === 0} onClick={submit}>
            {pending && <Loader2Icon className="animate-spin" />}
            Emitir recibo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AttendanceDialog({ contactId, bookings }: { contactId: string; bookings: BillableBooking[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [bookingId, setBookingId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileCheckIcon /> Declaração
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Declaração de comparecimento</DialogTitle>
          <DialogDescription>
            Comprova a presença no horário, sem informar o motivo do atendimento.
          </DialogDescription>
        </DialogHeader>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atendimento realizado ainda.</p>
        ) : (
          <RadioGroup
            value={bookingId}
            onValueChange={setBookingId}
            className="max-h-64 gap-0 overflow-y-auto rounded-lg border"
          >
            {bookings.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted/40"
              >
                <RadioGroupItem value={b.id} /> {b.label}
              </label>
            ))}
          </RadioGroup>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending || !bookingId}
            onClick={() =>
              startTransition(async () => {
                const res = await issueDocument({ kind: "attendance", contactId, bookingIds: [bookingId] })
                if (!res.ok) {
                  setError(res.error)
                  return
                }
                setOpen(false)
                setBookingId("")
                opened(res.id, res.number, router)
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Emitir declaração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DocIcon({ kind }: { kind: DocumentKind }) {
  const Icon = {
    receipt: ReceiptIcon,
    attendance: FileCheckIcon,
    certificate: StethoscopeIcon,
    prescription: PillIcon,
  }[kind]
  return <Icon className="size-5" />
}

function CertificateDialog({ contactId, bookings }: { contactId: string; bookings: BillableBooking[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [bookingId, setBookingId] = useState("")
  const [days, setDays] = useState("0")
  const [cid, setCid] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await issueDocument({
        kind: "certificate",
        contactId,
        bookingIds: [bookingId],
        days: Number(days) || 0,
        cid: cid || undefined,
      })
      if (!res.ok) return setError(res.error)
      setOpen(false)
      setBookingId("")
      setDays("0")
      setCid("")
      opened(res.id, res.number, router)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <StethoscopeIcon /> Atestado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atestado</DialogTitle>
          <DialogDescription>
            Escolha o atendimento e, se for o caso, os dias de afastamento.
          </DialogDescription>
        </DialogHeader>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atendimento realizado ainda.</p>
        ) : (
          <div className="grid gap-4">
            <RadioGroup
              value={bookingId}
              onValueChange={setBookingId}
              className="max-h-48 gap-0 overflow-y-auto rounded-lg border"
            >
              {bookings.map((b) => (
                <label
                  key={b.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted/40"
                >
                  <RadioGroupItem value={b.id} /> {b.label}
                </label>
              ))}
            </RadioGroup>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="c-days">Dias de afastamento</Label>
                <Input
                  id="c-days"
                  type="number"
                  min={0}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-cid">CID (opcional)</Label>
                <Input
                  id="c-cid"
                  value={cid}
                  onChange={(e) => setCid(e.target.value.toUpperCase())}
                  placeholder="J06.9"
                  className="h-10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Só informe o CID com autorização expressa do paciente.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={pending || !bookingId} onClick={submit}>
            {pending && <Loader2Icon className="animate-spin" />}
            Emitir atestado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type RxItem = { name: string; instructions: string }

function PrescriptionDialog({ contactId }: { contactId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [usage, setUsage] = useState<string>(PRESCRIPTION_USAGES[0])
  const [items, setItems] = useState<RxItem[]>([{ name: "", instructions: "" }])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const update = (i: number, patch: Partial<RxItem>) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)))

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await issueDocument({
        kind: "prescription",
        contactId,
        usage: usage as (typeof PRESCRIPTION_USAGES)[number],
        items,
        notes: notes || undefined,
      })
      if (!res.ok) return setError(res.error)
      setOpen(false)
      setItems([{ name: "", instructions: "" }])
      setNotes("")
      opened(res.id, res.number, router)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PillIcon /> Receituário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receituário simples</DialogTitle>
          <DialogDescription>
            Para medicamentos sem retenção de receita. Controlados exigem o receituário oficial.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label>Uso</Label>
            <Select value={usage} onValueChange={setUsage}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESCRIPTION_USAGES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">{i + 1}.</span>
                <Input
                  aria-label={`Medicamento ${i + 1}`}
                  value={item.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Amoxicilina 500 mg, 21 cápsulas"
                />
                {items.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover item ${i + 1}`}
                    onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
              <Textarea
                aria-label={`Posologia ${i + 1}`}
                value={item.instructions}
                onChange={(e) => update(i, { instructions: e.target.value })}
                placeholder="Tomar 1 cápsula de 8 em 8 horas por 7 dias."
                className="min-h-14"
              />
            </div>
          ))}
          {items.length < 12 && (
            <Button
              variant="ghost"
              className="w-fit rounded-full"
              onClick={() => setItems((list) => [...list, { name: "", instructions: "" }])}
            >
              <PlusIcon /> Adicionar item
            </Button>
          )}
          <div className="grid gap-2">
            <Label htmlFor="rx-notes">Orientações (opcional)</Label>
            <Textarea
              id="rx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-14"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending && <Loader2Icon className="animate-spin" />}
            Emitir receita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
