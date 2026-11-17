import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/app/page-header"
import { ModulesSettings } from "@/components/app/settings/modules-settings"
import { modulesForVertical } from "@/lib/modules"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Recursos" }

export default async function FeaturesSettingsPage() {
  const { org, vertical, can } = await requireWorkspace()
  if (!can("settings:manage")) redirect("/app/settings")
  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Recursos"
        description="Escolha quais ferramentas aparecem no seu painel."
      />
      <ModulesSettings
        verticalLabel={vertical.label}
        enabled={org.modules as string[]}
        modules={modulesForVertical(vertical.id, vertical.group).map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description,
          clinical: m.clinical,
          comingSoon: Boolean(m.comingSoon),
        }))}
      />
    </>
  )
}
