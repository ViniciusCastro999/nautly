"use server"

import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db, schema } from "@/db"
import { requireUser } from "@/lib/session"
import { applyVerticalPreset } from "@/lib/vertical-preset"
import { VERTICAL_IDS } from "@/lib/verticals"

const onboardingSchema = z.object({
  vertical: z.enum(VERTICAL_IDS),
  kind: z.enum(["personal", "clinic"]),
  organizationName: z.string().trim().max(100).optional(),
  professionalRegistry: z.string().trim().max(40).optional(),
})

export async function completeOnboarding(input: z.input<typeof onboardingSchema>) {
  const { user, org, role } = await requireUser()
  if (role !== "owner") return { ok: false as const, error: "Apenas o proprietário pode configurar a conta." }

  const parsed = onboardingSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Escolha uma área para continuar." }
  const data = parsed.data

  if (data.kind === "clinic" && !data.organizationName) {
    return { ok: false as const, error: "Informe o nome da clínica ou do estabelecimento." }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.organization)
      .set({
        kind: data.kind,
        name: data.kind === "clinic" ? data.organizationName! : user.name,
      })
      .where(eq(schema.organization.id, org.id))

    if (data.professionalRegistry) {
      await tx
        .update(schema.user)
        .set({ professionalRegistry: data.professionalRegistry })
        .where(eq(schema.user.id, user.id))
    }

    await applyVerticalPreset(tx, { organizationId: org.id, userId: user.id, vertical: data.vertical })
  })

  redirect("/app/event-types?welcome=1")
}
