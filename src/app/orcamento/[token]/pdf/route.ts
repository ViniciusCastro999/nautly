import { NextResponse } from "next/server"
import { budgetPdfResponse, loadBudget } from "@/lib/treatment-budget"

/** PDF do orçamento para o paciente, pelo mesmo link secreto da aprovação. */
export async function GET(_request: Request, { params }: RouteContext<"/orcamento/[token]/pdf">) {
  const { token } = await params
  if (!/^[a-f0-9]{32}$/.test(token)) return new NextResponse("Não encontrado", { status: 404 })
  const budget = await loadBudget({ token })
  // Rascunhos ainda não foram enviados ao paciente.
  if (!budget || budget.plan.status === "draft") return new NextResponse("Não encontrado", { status: 404 })
  return budgetPdfResponse(budget)
}
