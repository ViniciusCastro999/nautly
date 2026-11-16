"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { saveContact, type ContactInput } from "@/server/contacts"

export function ContactFormDialog({
  contact,
  clientNoun,
  children,
}: {
  contact?: ContactInput & { id: string }
  clientNoun: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setError(null)
    startTransition(async () => {
      const res = await saveContact({ ...form, id: contact?.id } as ContactInput)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      toast.success(contact ? "Cadastro atualizado" : "Cadastro criado")
      if (contact) router.refresh()
      else router.push(`/app/contacts/${res.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Editar cadastro" : `Novo ${clientNoun}`}</DialogTitle>
          <DialogDescription>Dados de contato e identificação.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="c-name">Nome completo *</Label>
            <Input id="c-name" name="name" required defaultValue={contact?.name} className="h-10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-email">E-mail</Label>
            <Input
              id="c-email"
              name="email"
              type="email"
              defaultValue={contact?.email ?? ""}
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-phone">Telefone / WhatsApp</Label>
            <Input id="c-phone" name="phone" defaultValue={contact?.phone ?? ""} className="h-10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-birth">Data de nascimento</Label>
            <Input
              id="c-birth"
              name="birthDate"
              type="date"
              defaultValue={contact?.birthDate ?? ""}
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-doc">CPF</Label>
            <Input id="c-doc" name="document" defaultValue={contact?.document ?? ""} className="h-10" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="c-notes">Observações administrativas</Label>
            <Textarea
              id="c-notes"
              name="notes"
              rows={3}
              defaultValue={contact?.notes ?? ""}
              placeholder="Ex.: prefere horários pela manhã. Não use para informações clínicas."
            />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
