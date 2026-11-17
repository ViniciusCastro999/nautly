"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { isVisible, type Answers, type Field, type Template } from "@/lib/anamnesis"
import { cn } from "@/lib/utils"
import { fillAnamnesis, submitPublicAnamnesis } from "@/server/anamnesis"

type Target = { kind: "public"; token: string } | { kind: "panel"; id: string }

export function AnamnesisForm({
  template,
  target,
  submitLabel = "Enviar respostas",
  onDone,
}: {
  template: Template
  target: Target
  submitLabel?: string
  onDone: () => void
}) {
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (id: string, value: string | string[]) => setAnswers((a) => ({ ...a, [id]: value }))

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res =
        target.kind === "public"
          ? await submitPublicAnamnesis(target.token, answers)
          : await fillAnamnesis(target.id, answers)
      if (!res.ok) {
        setError(res.error)
        setErrors(res.errors ?? {})
        return
      }
      onDone()
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8" noValidate>
      {template.sections.map((section) => (
        <fieldset key={section.title} className="grid gap-5">
          <legend className="mb-3 text-base font-bold">{section.title}</legend>
          {section.fields
            .filter((f) => isVisible(f, answers))
            .map((f) => (
              <FieldInput key={f.id} field={f} value={answers[f.id]} error={errors[f.id]} onChange={set} />
            ))}
        </fieldset>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  )
}

function FieldInput({
  field: f,
  value,
  error,
  onChange,
}: {
  field: Field
  value: string | string[] | undefined
  error?: string
  onChange: (id: string, value: string | string[]) => void
}) {
  const id = `f-${f.id}`
  const label = (
    <Label htmlFor={id} className="leading-snug">
      {f.label}
      {f.required && <span className="text-destructive">*</span>}
    </Label>
  )
  const text = typeof value === "string" ? value : ""

  let control: React.ReactNode
  switch (f.type) {
    case "textarea":
      control = (
        <Textarea
          id={id}
          value={text}
          placeholder={f.placeholder}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(f.id, e.target.value)}
          className="min-h-24"
        />
      )
      break
    case "yesno":
    case "radio": {
      const options = f.options ?? ["Sim", "Não"]
      control = (
        <RadioGroup
          value={text}
          onValueChange={(v) => onChange(f.id, v)}
          className={cn(
            "flex flex-wrap gap-2",
            f.type === "radio" && options.length > 3 && "grid sm:grid-cols-2",
          )}
        >
          {options.map((o) => (
            <label
              key={o}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                text === o ? "border-primary bg-accent" : "hover:bg-muted/50",
              )}
            >
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      )
      break
    }
    case "multi": {
      const list = Array.isArray(value) ? value : []
      control = (
        <div className="grid gap-2 sm:grid-cols-2">
          {f.options?.map((o) => (
            <label
              key={o}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                list.includes(o) ? "border-primary bg-accent" : "hover:bg-muted/50",
              )}
            >
              <Checkbox
                checked={list.includes(o)}
                onCheckedChange={(checked) =>
                  onChange(f.id, checked ? [...list, o] : list.filter((x) => x !== o))
                }
              />
              {o}
            </label>
          ))}
        </div>
      )
      break
    }
    default:
      control = (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={text}
            inputMode={f.type === "number" ? "decimal" : undefined}
            placeholder={f.placeholder}
            aria-invalid={Boolean(error)}
            onChange={(e) => onChange(f.id, e.target.value)}
            className={cn("h-10", f.type === "number" && "max-w-32")}
          />
          {f.unit && <span className="text-sm text-muted-foreground">{f.unit}</span>}
        </div>
      )
  }

  return (
    <div className="grid gap-2">
      {label}
      {control}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
