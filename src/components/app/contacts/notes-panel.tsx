"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { FileTextIcon, Loader2Icon, LockIcon, PencilIcon, ShieldCheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createNote, updateNote } from "@/server/clinical"

type Note = {
  id: string
  content: string
  isPrivate: boolean
  isMine: boolean
  authorName: string
  createdAt: string
  edited: boolean
  bookingLabel: string | null
}

const NO_BOOKING = "none"

export function NotesPanel({
  contactId,
  canWrite,
  bookings,
  notes,
}: {
  contactId: string
  canWrite: boolean
  bookings: { id: string; label: string }[]
  notes: Note[]
}) {
  const [content, setContent] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? NO_BOOKING)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await createNote({
        contactId,
        content,
        isPrivate,
        bookingId: bookingId === NO_BOOKING ? undefined : bookingId,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setContent("")
      setIsPrivate(false)
      toast.success("Registro salvo")
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid h-fit gap-4">
        {canWrite && (
          <section className="rounded-[13px] border bg-card p-5">
            <h2 className="mb-3 font-semibold">Novo registro</h2>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Evolução, queixa, conduta, orientações..."
              className="resize-y"
            />
            <div className="mt-3 flex flex-wrap items-end gap-4">
              {bookings.length > 0 && (
                <div className="grid min-w-56 flex-1 gap-1.5">
                  <Label className="text-xs text-muted-foreground">Referente ao atendimento</Label>
                  <Select value={bookingId} onValueChange={setBookingId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_BOOKING}>Sem vínculo</SelectItem>
                      {bookings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                Anotação privada
              </label>
              <Button className="ml-auto" disabled={pending || !content.trim()} onClick={submit}>
                {pending && <Loader2Icon className="animate-spin" />}
                Salvar registro
              </Button>
            </div>
          </section>
        )}

        {notes.length === 0 ? (
          <div className="flex flex-col items-center rounded-[13px] border border-dashed bg-card p-10 text-center">
            <FileTextIcon className="mb-3 size-8 text-muted-foreground" />
            <p className="font-semibold">Prontuário vazio</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os registros aparecem aqui em ordem cronológica.
            </p>
          </div>
        ) : (
          <ol className="relative grid gap-4 border-l-2 border-border pl-6">
            {notes.map((n) => (
              <NoteItem key={n.id} note={n} />
            ))}
          </ol>
        )}
      </div>

      <aside className="h-fit rounded-[13px] border bg-card p-5 text-sm">
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <ShieldCheckIcon className="size-4 text-success" /> Proteção dos dados
        </p>
        <ul className="grid gap-2 text-muted-foreground">
          <li>Texto criptografado (AES-256) antes de ser salvo no banco.</li>
          <li>Anotações privadas ficam visíveis só para quem escreveu.</li>
          <li>Registros não podem ser apagados, apenas editados pelo autor.</li>
          <li>Cada acesso ao prontuário fica registrado na aba Acessos.</li>
        </ul>
      </aside>
    </div>
  )
}

function NoteItem({ note: n }: { note: Note }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(n.content)
  const [pending, startTransition] = useTransition()

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute top-5 -left-[31px] size-3.5 rounded-full border-2 border-background",
          n.isPrivate ? "bg-amber-500" : "bg-primary",
        )}
      />
      <article className={cn("rounded-[13px] border bg-card p-5", n.isPrivate && "border-amber-500/40")}>
        <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold">{n.createdAt}</span>
          <span className="text-muted-foreground">por {n.authorName}</span>
          {n.bookingLabel && <Badge variant="secondary">{n.bookingLabel}</Badge>}
          {n.isPrivate && (
            <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <LockIcon className="size-3" /> Privada
            </Badge>
          )}
          {n.edited && <span className="text-xs text-muted-foreground">(editado)</span>}
          {n.isMine && !editing && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label="Editar"
              onClick={() => setEditing(true)}
            >
              <PencilIcon />
            </Button>
          )}
        </header>
        {editing ? (
          <div className="grid gap-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(n.content)
                  setEditing(false)
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await updateNote(n.id, draft)
                    if (res.ok) {
                      setEditing(false)
                      toast.success("Registro atualizado")
                    } else toast.error(res.error)
                  })
                }
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{n.content}</p>
        )}
      </article>
    </li>
  )
}
