"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { answerPlanByToken } from "@/server/treatment-plans"

export function PublicApproval({ token, total }: { token: string; total: string }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function answer(decision: "approve" | "reject") {
    setError(null)
    if (decision === "reject" && !confirm("Recusar este orçamento? O consultório será avisado.")) return
    startTransition(async () => {
      const res = await answerPlanByToken({ token, decision, name })
      if (!res.ok) return setError(res.error)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-muted/40 p-5">
      <div className="grid gap-2">
        <Label htmlFor="approver">Seu nome completo</Label>
        <Input
          id="approver"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="bg-background"
        />
      </div>
      <Label className="flex items-start gap-2 leading-snug font-normal">
        <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
        Li o plano de tratamento e concordo com os procedimentos e o valor total de {total}.
      </Label>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          className="rounded-full"
          size="lg"
          disabled={pending || !agree || name.trim().length < 3}
          onClick={() => answer("approve")}
        >
          {pending && <Loader2Icon className="animate-spin" />}
          Aprovar orçamento
        </Button>
        <Button
          variant="ghost"
          className="rounded-full"
          size="lg"
          disabled={pending}
          onClick={() => answer("reject")}
        >
          Recusar
        </Button>
      </div>
    </div>
  )
}
