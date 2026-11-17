import type { requireWorkspace } from "@/lib/session"

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>

export type SettingsIcon = "profile" | "availability" | "integrations" | "features" | "team"

export type SettingsSection = {
  href: string
  label: string
  description: string
  icon: SettingsIcon
}

/** Telas de configuração que a pessoa logada pode abrir, na ordem do menu. */
export function settingsSections(ws: Pick<Workspace, "org" | "can" | "hasModule">): SettingsSection[] {
  const manage = ws.can("settings:manage")
  const isClinic = ws.org.kind === "clinic"
  const list: (SettingsSection | false)[] = [
    manage && {
      href: "/app/settings/profile",
      label: "Perfil profissional",
      description: "Área de atuação, registro, CPF/CNPJ e endereço.",
      icon: "profile",
    },
    {
      href: "/app/settings/availability",
      label: "Disponibilidade",
      description: "Dias e horários em que você aceita agendamentos.",
      icon: "availability",
    },
    {
      href: "/app/settings/integrations",
      label: "Integrações",
      description: "Google Calendar sincronizado com a sua agenda.",
      icon: "integrations",
    },
    manage && {
      href: "/app/settings/features",
      label: "Recursos",
      description: "Ative ou desative as ferramentas do painel.",
      icon: "features",
    },
    manage && {
      href: "/app/settings/team",
      label: isClinic ? "Equipe" : "Acesso",
      description: isClinic
        ? "Quem faz parte da clínica e o papel de cada um."
        : "Quem pode acessar a sua conta.",
      icon: "team",
    },
  ]
  return list.filter((s): s is SettingsSection => Boolean(s))
}
