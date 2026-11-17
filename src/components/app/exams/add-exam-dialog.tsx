"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Exame sempre entra pela ficha: escolhe o paciente e abre a aba de anexos. */
export function AddExamDialog({
  clientNoun,
  contacts,
}: {
  clientNoun: string
  contacts: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [contactId, setContactId] = useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <PlusIcon /> Adicionar exame
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar exame</DialogTitle>
          <DialogDescription>
            Escolha o {clientNoun.toLowerCase()}. O laudo fica guardado na ficha dele, com criptografia.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>{clientNoun.charAt(0).toUpperCase() + clientNoun.slice(1)}</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Selecione o ${clientNoun.toLowerCase()}`} />
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!contactId}
            onClick={() => router.push(`/app/contacts/${contactId}?tab=attachments`)}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
