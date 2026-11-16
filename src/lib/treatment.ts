/** Regras do plano de tratamento / orçamento. */

export type PlanStatus = "draft" | "presented" | "approved" | "rejected" | "completed"

export const PLAN_STATUS: Record<PlanStatus, { label: string; tone: "muted" | "info" | "ok" | "danger" }> = {
  draft: { label: "Rascunho", tone: "muted" },
  presented: { label: "Aguardando aprovação", tone: "info" },
  approved: { label: "Aprovado, em andamento", tone: "ok" },
  rejected: { label: "Recusado", tone: "danger" },
  completed: { label: "Concluído", tone: "ok" },
}

/** Itens e desconto só mudam antes da aprovação. */
export function canEditItems(status: PlanStatus) {
  return status === "draft" || status === "presented"
}

/** Procedimentos só são executados depois que o paciente aprovou. */
export function canExecute(status: PlanStatus) {
  return status === "approved" || status === "completed"
}

export function planTotals(items: { priceCents: number; done: boolean }[], discountCents: number) {
  const subtotal = items.reduce((sum, i) => sum + i.priceCents, 0)
  const discount = Math.min(Math.max(discountCents, 0), subtotal)
  const doneCount = items.filter((i) => i.done).length
  return {
    subtotal,
    discount,
    total: subtotal - discount,
    doneCount,
    count: items.length,
    progress: items.length ? Math.round((doneCount / items.length) * 100) : 0,
  }
}

/** Status depois de marcar/desmarcar um item como feito. */
export function statusAfterExecution(status: PlanStatus, allDone: boolean): PlanStatus {
  if (status === "approved" && allDone) return "completed"
  if (status === "completed" && !allDone) return "approved"
  return status
}
