import { NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/session"
import { budgetPdfResponse, loadBudget } from "@/lib/treatment-budget"

export async function GET(_request: Request, { params }: RouteContext<"/api/treatment-plans/[id]/pdf">) {
  const { id } = await params
  const ctx = await requireWorkspace()
  if (!ctx.canUseModule("treatment_plan")) return new NextResponse("Sem permissão", { status: 403 })

  const budget = await loadBudget({ id })
  if (!budget || budget.plan.organizationId !== ctx.org.id) {
    return new NextResponse("Não encontrado", { status: 404 })
  }
  return budgetPdfResponse(budget)
}
