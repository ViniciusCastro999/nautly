"use client"

import { useState } from "react"
import { CircleCheckIcon } from "lucide-react"
import type { Template } from "@/lib/anamnesis"
import { AnamnesisForm } from "./anamnesis-form"

export function PublicAnamnesis({ token, template }: { token: string; template: Template }) {
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CircleCheckIcon className="mb-3 size-10 text-success" />
        <p className="text-lg font-semibold">Respostas enviadas</p>
        <p className="mt-1 text-muted-foreground">Obrigado! Até o nosso atendimento.</p>
      </div>
    )
  }

  return (
    <AnamnesisForm
      template={template}
      target={{ kind: "public", token }}
      onDone={() => {
        setDone(true)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }}
    />
  )
}
