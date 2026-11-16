"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ClipboardListIcon,
  CopyIcon,
  Loader2Icon,
  MessageCircleIcon,
  PencilLineIcon,
  SendIcon,
} from "lucide-react"
import { AnamnesisForm } from "@/components/anamnesis/anamnesis-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Template } from "@/lib/anamnesis"
import { requestAnamnesis } from "@/server/anamnesis"

export type AnamnesisView = {
  id: string
  title: string
  token: string
  status: "pending" | "completed"
  createdAt: string
  completedAt: string | null
  filledBy: "patient" | "professional" | null
  /** Só para pendentes: modelo usado no preenchimento pelo profissional. */
  template?: Template
  /** Só para concluídas: respostas já formatadas, por seção. */
  sections?: { title: string; items: { label: string; value: string | null }[] }[]
}

function publicUrl(token: string) {
  return `${window.location.origin}/anamnese/${token}`
}

function whatsappUrl(phone: string | null, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "")
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export function AnamnesisPanel({
  contactId,
  contactName,
  contactPhone,
  canWrite,
  forms,
}: {
  contactId: string
  contactName: string
  contactPhone: string | null
  canWrite: boolean
  forms: AnamnesisView[]
}) {
  const router = useRouter()
  const [filling, setFilling] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const firstName = contactName.split(" ")[0]

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(publicUrl(token))
    toast.success("Link copiado")
  }

  const message = (token: string) =>
    `Olá, ${firstName}! Antes do nosso atendimento, preencha sua anamnese por este link: ${publicUrl(token)}`

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <ClipboardListIcon className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Anamnese</h2>
            <p className="text-sm text-muted-foreground">
              Envie o link para {firstName} responder antes do atendimento, ou preencha junto na consulta.
            </p>
          </div>
        </div>
        {canWrite && (
          <Button
            className="rounded-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await requestAnamnesis(contactId)
                if (!res.ok) {
                  toast.error(res.error)
                  return
                }
                await copy(res.token)
                router.refresh()
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            Nova anamnese
          </Button>
        )}
      </div>

      {forms.length === 0 && (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma anamnese ainda.
        </p>
      )}

      {forms.map((f) => (
        <section key={f.id} className="overflow-hidden rounded-xl border bg-card">
          <header className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
            <h3 className="font-semibold">{f.title}</h3>
            {f.status === "pending" ? (
              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                Aguardando resposta
              </Badge>
            ) : (
              <Badge variant="outline" className="border-success text-success">
                Respondida
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {f.status === "completed"
                ? `${f.filledBy === "patient" ? `Respondida por ${firstName}` : "Preenchida no atendimento"} em ${f.completedAt}`
                : `Criada em ${f.createdAt}`}
            </span>
          </header>

          {f.status === "pending" && canWrite && (
            <div className="grid gap-4 p-5">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => copy(f.token)}>
                  <CopyIcon /> Copiar link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    window.open(whatsappUrl(contactPhone, message(f.token)), "_blank", "noopener")
                  }
                >
                  <MessageCircleIcon /> Enviar por WhatsApp
                </Button>
                <Button
                  variant={filling === f.id ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setFilling(filling === f.id ? null : f.id)}
                >
                  <PencilLineIcon /> Preencher agora
                </Button>
              </div>
              {filling === f.id && f.template && (
                <div className="rounded-lg border p-5">
                  <AnamnesisForm
                    template={f.template}
                    target={{ kind: "panel", id: f.id }}
                    submitLabel="Salvar anamnese"
                    onDone={() => {
                      setFilling(null)
                      toast.success("Anamnese salva")
                      router.refresh()
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {f.sections && (
            <div className="grid gap-6 p-5 md:grid-cols-2">
              {f.sections.map((s) => (
                <div key={s.title}>
                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{s.title}</h4>
                  <dl className="grid gap-2 text-sm">
                    {s.items.map((item) => (
                      <div key={item.label}>
                        <dt className="text-muted-foreground">{item.label}</dt>
                        <dd
                          className={
                            item.value ? "font-medium whitespace-pre-wrap" : "text-muted-foreground/60"
                          }
                        >
                          {item.value ?? "Não respondido"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
