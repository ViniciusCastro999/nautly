import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { auth } from "@/lib/auth"
import { MODULES, type ModuleId } from "@/lib/modules"
import { assertCan, can, type Permission } from "@/lib/permissions"
import { getVertical } from "@/lib/verticals"

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

/**
 * Usuário autenticado + organização atual, sem exigir onboarding concluído.
 * Toda query do painel deve filtrar por `org.id`: é o isolamento entre tenants.
 */
export const requireUser = cache(async () => {
  const session = await getSession()
  if (!session) redirect("/login")

  const member = await db.query.membership.findFirst({
    where: eq(schema.membership.userId, session.user.id),
    with: { organization: true },
  })
  if (!member) redirect("/login")

  const user = await db.query.user.findFirst({ where: eq(schema.user.id, session.user.id) })
  if (!user) redirect("/login")

  return { user, org: member.organization, role: member.role }
})

/** Workspace completo: exige onboarding concluído e resolve área, módulos e vocabulário. */
export const requireWorkspace = cache(async () => {
  const ctx = await requireUser()
  if (!ctx.org.vertical) redirect("/onboarding")

  const vertical = getVertical(ctx.org.vertical)
  const modules = new Set(ctx.org.modules as ModuleId[])

  return {
    ...ctx,
    vertical,
    vocab: vertical.vocabulary,
    hasModule: (id: ModuleId) => modules.has(id),
    can: (p: Permission) => can(ctx.role, p),
    /** Módulo ativo E permissão de acesso (clínicos exigem clinical:read). */
    canUseModule: (id: ModuleId) =>
      modules.has(id) && (!MODULES[id].clinical || can(ctx.role, "clinical:read")),
  }
})

/** Para Server Actions: garante permissão ou lança erro. */
export async function requirePermission(permission: Permission) {
  const ctx = await requireWorkspace()
  assertCan(ctx.role, permission)
  return ctx
}
