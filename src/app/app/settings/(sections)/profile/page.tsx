import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/app/page-header"
import { ProfileSettings } from "@/components/app/settings/profile-settings"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Perfil profissional" }

export default async function ProfileSettingsPage() {
  const { org, user, vertical, can } = await requireWorkspace()
  if (!can("settings:manage")) redirect("/app/settings")
  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Perfil profissional"
        description="Esses dados aparecem nos documentos e recibos."
      />
      <ProfileSettings
        vertical={vertical.id}
        organizationName={org.name}
        isClinic={org.kind === "clinic"}
        professionalRegistry={user.professionalRegistry ?? ""}
        taxId={user.taxId ?? ""}
        address={user.address ?? ""}
      />
    </>
  )
}
