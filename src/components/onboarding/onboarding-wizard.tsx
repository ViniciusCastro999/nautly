"use client"

import { useState, useTransition } from "react"
import { ArrowLeftIcon, CheckIcon, ClockIcon, Loader2Icon, UserIcon, UsersIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VerticalIcon } from "@/components/vertical-icon"
import { MODULES, modulesForVertical } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { VERTICAL_GROUPS, VERTICALS, type VerticalId } from "@/lib/verticals"
import { completeOnboarding } from "@/server/onboarding"

type Step = "area" | "team" | "review"

function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ["area", "team", "review"]
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all",
            steps.indexOf(step) >= i ? "w-8 bg-primary" : "w-4 bg-border",
          )}
        />
      ))}
    </div>
  )
}

export function OnboardingWizard({ firstName }: { firstName: string }) {
  const [step, setStep] = useState<Step>("area")
  const [vertical, setVertical] = useState<VerticalId | null>(null)
  const [kind, setKind] = useState<"personal" | "clinic">("personal")
  const [organizationName, setOrganizationName] = useState("")
  const [registry, setRegistry] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const v = vertical ? VERTICALS[vertical] : null
  const teamNoun = v?.group === "beauty" ? "salão ou estúdio" : v?.group === "health" ? "clínica" : "empresa"

  function finish() {
    if (!vertical) return
    setError(null)
    startTransition(async () => {
      const res = await completeOnboarding({
        vertical,
        kind,
        organizationName: kind === "clinic" ? organizationName : undefined,
        professionalRegistry: registry || undefined,
      })
      if (res && !res.ok) setError(res.error)
    })
  }

  return (
    <div className="w-full max-w-3xl">
      <StepDots step={step} />

      {step === "area" && (
        <section>
          <h1 className="text-center text-3xl font-extrabold tracking-tight">
            Olá, {firstName}! Qual é a sua área?
          </h1>
          <p className="mt-2 text-center text-muted-foreground">
            Vamos adaptar o Nautly para o seu dia a dia. Você pode mudar isso depois.
          </p>
          <div className="mt-10 grid gap-8">
            {VERTICAL_GROUPS.map((group) => (
              <div key={group.id}>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.verticals.map((id) => {
                    const item = VERTICALS[id]
                    const selected = vertical === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setVertical(id)}
                        className={cn(
                          "relative flex items-start gap-3 rounded-[13px] border bg-card p-4 text-left transition-all hover:border-primary/60 hover:shadow-sm",
                          selected && "border-primary ring-2 ring-primary/30",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary",
                            selected && "bg-primary text-primary-foreground",
                          )}
                        >
                          <VerticalIcon vertical={id} className="size-5" />
                        </span>
                        <span>
                          <span className="block font-semibold">{item.label}</span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        {selected && (
                          <CheckIcon className="absolute top-3 right-3 size-4 text-primary" strokeWidth={3} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-end">
            <Button
              size="lg"
              className="h-11 rounded-full px-8"
              disabled={!vertical}
              onClick={() => setStep("team")}
            >
              Continuar
            </Button>
          </div>
        </section>
      )}

      {step === "team" && v && (
        <section className="mx-auto max-w-xl">
          <h1 className="text-center text-3xl font-extrabold tracking-tight">
            Você atende sozinho ou em equipe?
          </h1>
          <p className="mt-2 text-center text-muted-foreground">
            Em equipe, você poderá convidar outros profissionais e a recepção.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { id: "personal" as const, icon: UserIcon, title: "Sozinho", text: "Uma agenda, só minha." },
              {
                id: "clinic" as const,
                icon: UsersIcon,
                title: "Em equipe",
                text: `Uma ${teamNoun} com vários profissionais.`,
              },
            ].map(({ id, icon: Icon, title, text }) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[13px] border bg-card p-6 text-center transition-all hover:border-primary/60",
                  kind === id && "border-primary ring-2 ring-primary/30",
                )}
              >
                <Icon className="size-7 text-primary" />
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            {kind === "clinic" && (
              <div className="grid gap-2">
                <Label htmlFor="orgName">Nome da {teamNoun}</Label>
                <Input
                  id="orgName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="h-10"
                  placeholder={v.group === "beauty" ? "Ex.: Barbearia do Centro" : "Ex.: Clínica Bem Viver"}
                />
              </div>
            )}
            {v.registryLabel && (
              <div className="grid gap-2">
                <Label htmlFor="registry">Seu {v.registryLabel} (opcional)</Label>
                <Input
                  id="registry"
                  value={registry}
                  onChange={(e) => setRegistry(e.target.value)}
                  className="h-10"
                  placeholder={`${v.registryLabel} 00/000000`}
                />
                <p className="text-xs text-muted-foreground">Aparece em recibos e documentos.</p>
              </div>
            )}
          </div>

          <div className="mt-10 flex justify-between">
            <Button variant="ghost" onClick={() => setStep("area")}>
              <ArrowLeftIcon /> Voltar
            </Button>
            <Button
              size="lg"
              className="h-11 rounded-full px-8"
              disabled={kind === "clinic" && !organizationName.trim()}
              onClick={() => setStep("review")}
            >
              Continuar
            </Button>
          </div>
        </section>
      )}

      {step === "review" && v && vertical && (
        <section className="mx-auto max-w-xl">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-[16px] bg-primary text-primary-foreground">
            <VerticalIcon vertical={vertical} className="size-7" />
          </div>
          <h1 className="text-center text-3xl font-extrabold tracking-tight">Tudo pronto para {v.label}</h1>
          <p className="mt-2 text-center text-muted-foreground">
            Seu painel vai chamar quem agenda de <strong>{v.vocabulary.client}</strong>.
          </p>

          <div className="mt-8 grid gap-4 rounded-[13px] border bg-card p-6">
            <div>
              <p className="mb-2 text-sm font-semibold">Ativado para você</p>
              <ul className="grid gap-2">
                <li className="flex items-start gap-2 text-sm">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} />
                  Agenda online, página de agendamento e cadastro de {v.vocabulary.clients.toLowerCase()}
                </li>
                {v.defaultModules.map((id) => (
                  <li key={id} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} />
                    <span>
                      <strong>{MODULES[id].label}</strong>: {MODULES[id].description}
                    </span>
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} />
                  Tipos de evento de exemplo: {v.eventPresets.map((e) => e.title).join(", ")}
                </li>
              </ul>
            </div>
            {modulesForVertical(vertical, v.group).some((m) => m.comingSoon) && (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-semibold">Em breve para {v.label}</p>
                <div className="flex flex-wrap gap-2">
                  {modulesForVertical(vertical, v.group)
                    .filter((m) => m.comingSoon)
                    .map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        <ClockIcon className="size-3" /> {m.label}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

          <div className="mt-10 flex justify-between">
            <Button variant="ghost" onClick={() => setStep("team")}>
              <ArrowLeftIcon /> Voltar
            </Button>
            <Button size="lg" className="h-11 px-8" disabled={pending} onClick={finish}>
              {pending && <Loader2Icon className="animate-spin" />}
              Ir para o painel
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
