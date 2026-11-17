import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CircleCheckIcon, CircleXIcon, ClockIcon, FileDownIcon } from "lucide-react"
import { PublicShell } from "@/components/booking/public-shell"
import { PublicApproval } from "@/components/treatment/public-approval"
import { Button } from "@/components/ui/button"
import { formatBRL } from "@/lib/documents/money"
import { loadBudget } from "@/lib/treatment-budget"

export const metadata: Metadata = { title: "Orçamento", robots: { index: false } }

export default async function PublicBudgetPage({ params }: PageProps<"/orcamento/[token]">) {
  const { token } = await params
  if (!/^[a-f0-9]{32}$/.test(token)) notFound()
  const budget = await loadBudget({ token })
  if (!budget || budget.plan.status === "draft") notFound()

  const { plan, totals } = budget
  const firstName = plan.contact.name.split(" ")[0]
  const answered = plan.status !== "presented"

  return (
    <PublicShell>
      <div className="w-full max-w-2xl rounded-[16px] border bg-card p-6 shadow-[0_1px_8px_rgba(0,0,0,0.08)] sm:p-10 dark:shadow-none">
        <p className="text-sm font-semibold text-muted-foreground">{plan.organization.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{plan.title}</h1>
        <p className="mt-2 text-muted-foreground">
          Olá, {firstName}. Este é o orçamento preparado por {plan.createdBy.name} em {budget.createdOn}
          {budget.validUntil && `, válido até ${budget.validUntil}`}.
        </p>

        <ul className="mt-6 divide-y rounded-[13px] border">
          {budget.items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{item.description}</p>
                {item.detail && <p className="text-sm text-muted-foreground">{item.detail}</p>}
              </div>
              <span className="font-semibold whitespace-nowrap tabular-nums">{item.price}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 ml-auto grid max-w-64 gap-1 text-sm">
          {totals.discount > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatBRL(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Desconto</dt>
                <dd className="tabular-nums">- {formatBRL(totals.discount)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold">
            <dt>Total</dt>
            <dd className="text-primary tabular-nums">{formatBRL(totals.total)}</dd>
          </div>
        </dl>

        {plan.notes && (
          <div className="mt-6 rounded-[13px] bg-muted/50 p-4 text-sm">
            <p className="mb-1 font-semibold">Observações</p>
            <p className="whitespace-pre-line text-muted-foreground">{plan.notes}</p>
          </div>
        )}

        <div className="mt-8">
          {plan.status === "presented" && budget.expired ? (
            <Status icon={ClockIcon} tone="text-muted-foreground" title="Orçamento expirado">
              Fale com o consultório para receber um orçamento atualizado.
            </Status>
          ) : plan.status === "presented" ? (
            <PublicApproval token={token} total={formatBRL(totals.total)} />
          ) : plan.status === "rejected" ? (
            <Status icon={CircleXIcon} tone="text-destructive" title="Orçamento recusado">
              O consultório foi avisado. Se mudar de ideia, é só entrar em contato.
            </Status>
          ) : (
            <Status icon={CircleCheckIcon} tone="text-success" title="Orçamento aprovado">
              {budget.approval}. Obrigado, {firstName}!
            </Status>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <Button asChild variant={answered ? "default" : "outline"}>
            <a href={`/orcamento/${token}/pdf`} target="_blank" rel="noopener">
              <FileDownIcon /> Baixar PDF
            </a>
          </Button>
        </div>
      </div>
    </PublicShell>
  )
}

function Status({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof ClockIcon
  tone: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-[13px] border p-6 text-center">
      <Icon className={`mb-2 size-9 ${tone}`} />
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
