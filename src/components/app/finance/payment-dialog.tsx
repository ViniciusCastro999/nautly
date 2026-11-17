"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"
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
import { formatBRL, parseBRL } from "@/lib/documents/money"
import { recordPayment } from "@/server/payments"

export type UnpaidBooking = {
  id: string
  contactId: string
  label: string
  priceCents: number
}

const METHODS = [
  ["pix", "Pix"],
  ["card", "Cartão"],
  ["cash", "Dinheiro"],
  ["transfer", "Transferência"],
  ["other", "Outro"],
] as const
type Method = (typeof METHODS)[number][0]

const NONE = "avulso"

function centsToInput(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
}

export function PaymentDialog({
  children,
  clientNoun,
  contacts,
  unpaid,
  today,
  initial,
}: {
  children: React.ReactNode
  clientNoun: string
  contacts: { id: string; name: string }[]
  unpaid: UnpaidBooking[]
  /** yyyy-MM-dd no fuso do usuário. */
  today: string
  /** Abre já preenchido para um atendimento. */
  initial?: { contactId: string; bookingId: string }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [contactId, setContactId] = useState(initial?.contactId ?? "")
  const [bookingId, setBookingId] = useState(initial?.bookingId ?? NONE)
  const firstPrice = unpaid.find((b) => b.id === initial?.bookingId)?.priceCents
  const [amount, setAmount] = useState(firstPrice ? centsToInput(firstPrice) : "")
  const [method, setMethod] = useState<Method>("pix")
  const [paidOn, setPaidOn] = useState(today)
  const [description, setDescription] = useState("")
  const [pending, startTransition] = useTransition()

  const options = useMemo(() => unpaid.filter((b) => b.contactId === contactId), [unpaid, contactId])
  const lower = clientNoun.toLowerCase()

  function reset() {
    setContactId(initial?.contactId ?? "")
    setBookingId(initial?.bookingId ?? NONE)
    setAmount(firstPrice ? centsToInput(firstPrice) : "")
    setMethod("pix")
    setPaidOn(today)
    setDescription("")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseBRL(amount)
    if (!contactId) return toast.error(`Escolha o ${lower}.`)
    if (!cents) return toast.error("Informe um valor válido, ex.: 180,00")
    startTransition(async () => {
      const res = await recordPayment({
        contactId,
        bookingId: bookingId === NONE ? undefined : bookingId,
        amountCents: cents,
        method,
        paidOn,
        description: description || undefined,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Pagamento de ${formatBRL(cents)} registrado`)
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Ligue o pagamento a um atendimento para ele sair de “a receber”.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label>{clientNoun.charAt(0).toUpperCase() + clientNoun.slice(1)}</Label>
            <Select
              value={contactId}
              onValueChange={(v) => {
                setContactId(v)
                setBookingId(NONE)
              }}
              disabled={Boolean(initial)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Selecione o ${lower}`} />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Atendimento</Label>
            <Select
              value={bookingId}
              onValueChange={(v) => {
                setBookingId(v)
                const b = unpaid.find((x) => x.id === v)
                if (b) setAmount(centsToInput(b.priceCents))
              }}
              disabled={!contactId || Boolean(initial)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Pagamento avulso</SelectItem>
                {options.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pay-amount">Valor (R$)</Label>
              <Input
                id="pay-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="180,00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-date">Data</Label>
              <Input
                id="pay-date"
                type="date"
                value={paidOn}
                max={today}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bookingId === NONE && (
            <div className="grid gap-1.5">
              <Label htmlFor="pay-desc">Descrição (opcional)</Label>
              <Input
                id="pay-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: pacote de 4 retornos"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
