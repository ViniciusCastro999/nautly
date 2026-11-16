import "server-only"
import { and, count, eq } from "drizzle-orm"
import { schema, type Tx } from "@/db"
import { getVertical, type VerticalId } from "@/lib/verticals"

/** Aplica o preset de uma área: módulos padrão e tipos de evento iniciais. */
export async function applyVerticalPreset(
  tx: Tx,
  input: { organizationId: string; userId: string; vertical: VerticalId },
) {
  const vertical = getVertical(input.vertical)

  await tx
    .update(schema.organization)
    .set({ vertical: vertical.id, modules: vertical.defaultModules })
    .where(eq(schema.organization.id, input.organizationId))

  const sched = await tx.query.schedule.findFirst({
    where: and(eq(schema.schedule.userId, input.userId), eq(schema.schedule.isDefault, true)),
  })

  await ensureProcedureCatalog(tx, input.organizationId, vertical.id)

  if (vertical.eventPresets.length) {
    await tx
      .insert(schema.eventType)
      .values(
        vertical.eventPresets.map((preset) => ({
          ...preset,
          organizationId: input.organizationId,
          hostId: input.userId,
          scheduleId: sched?.id,
        })),
      )
      // Quem já tinha eventos com o mesmo link mantém os seus.
      .onConflictDoNothing()
  }
}

/** Cria o catálogo inicial de procedimentos da área, se a organização ainda não tem nenhum. */
export async function ensureProcedureCatalog(tx: Tx, organizationId: string, verticalId: VerticalId) {
  const presets = getVertical(verticalId).procedurePresets ?? []
  if (!presets.length) return
  const [{ total }] = await tx
    .select({ total: count() })
    .from(schema.procedure)
    .where(eq(schema.procedure.organizationId, organizationId))
  if (total > 0) return
  await tx.insert(schema.procedure).values(
    presets.map((p) => ({
      organizationId,
      name: p.name,
      priceCents: p.priceCents,
      effect: p.effect ?? null,
      perTooth: p.perTooth ?? false,
    })),
  )
}
