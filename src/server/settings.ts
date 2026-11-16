"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { isModuleId, MODULES, modulesForVertical, sanitizeModules } from "@/lib/modules"
import { requirePermission } from "@/lib/session"
import { ensureProcedureCatalog } from "@/lib/vertical-preset"
import { getVertical, VERTICAL_IDS } from "@/lib/verticals"

const profileSchema = z.object({
  vertical: z.enum(VERTICAL_IDS),
  organizationName: z.string().trim().min(2).max(100),
  professionalRegistry: z.string().trim().max(40),
  taxId: z.string().trim().max(20).default(""),
  address: z.string().trim().max(200).default(""),
})

export async function updateProfile(input: z.input<typeof profileSchema>) {
  const { org, user } = await requirePermission("settings:manage")
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Revise os campos." }
  const { vertical, organizationName, professionalRegistry, taxId, address } = parsed.data

  // Ao trocar de área, mantém os módulos que continuam fazendo sentido e liga os padrões da nova.
  const v = getVertical(vertical)
  const allowed = new Set(modulesForVertical(v.id, v.group).map((m) => m.id))
  const modules = sanitizeModules([
    ...(org.modules as string[]).filter((m) => isModuleId(m) && allowed.has(m)),
    ...(vertical !== org.vertical ? v.defaultModules : []),
  ])

  await db.transaction(async (tx) => {
    await tx
      .update(schema.organization)
      .set({ vertical, modules, name: organizationName })
      .where(eq(schema.organization.id, org.id))
    await tx
      .update(schema.user)
      .set({
        professionalRegistry: professionalRegistry || null,
        taxId: taxId || null,
        address: address || null,
      })
      .where(eq(schema.user.id, user.id))
    if (modules.includes("treatment_plan")) await ensureProcedureCatalog(tx, org.id, v.id)
  })

  revalidatePath("/app", "layout")
  return { ok: true as const }
}

export async function setModuleEnabled(moduleId: string, enabled: boolean) {
  const { org, vertical } = await requirePermission("settings:manage")
  if (!isModuleId(moduleId) || MODULES[moduleId].comingSoon) {
    return { ok: false as const, error: "Módulo indisponível." }
  }
  const allowed = modulesForVertical(vertical.id, vertical.group).some((m) => m.id === moduleId)
  if (enabled && !allowed) return { ok: false as const, error: "Módulo não disponível para sua área." }

  const current = new Set(org.modules as string[])
  if (enabled) current.add(moduleId)
  else current.delete(moduleId)

  await db.transaction(async (tx) => {
    await tx
      .update(schema.organization)
      .set({ modules: sanitizeModules([...current]) })
      .where(eq(schema.organization.id, org.id))
    if (enabled && moduleId === "treatment_plan") await ensureProcedureCatalog(tx, org.id, vertical.id)
  })

  revalidatePath("/app", "layout")
  return { ok: true as const }
}
