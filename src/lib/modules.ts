/**
 * Módulos que podem ser ligados por organização. A interface (sidebar, abas
 * da ficha) mostra apenas os módulos ativos, então cada área vê só o que usa.
 */
import type { VerticalGroup, VerticalId } from "./verticals"

export const MODULE_IDS = [
  "records",
  "attachments",
  "anamnesis",
  "recurring",
  "documents",
  "anthropometry",
  "meal_plan",
  "odontogram",
  "treatment_plan",
  "packages",
  "commissions",
] as const
export type ModuleId = (typeof MODULE_IDS)[number]

export type ModuleDef = {
  id: ModuleId
  label: string
  description: string
  /** Contém dado clínico/sensível: exige permissão clínica para acessar. */
  clinical: boolean
  /** Grupos de área em que o módulo faz sentido. */
  groups: VerticalGroup[]
  /** Se definido, restringe a áreas específicas. */
  verticals?: VerticalId[]
  /** Ainda não implementado: aparece como "em breve". */
  comingSoon?: boolean
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  records: {
    id: "records",
    label: "Prontuário",
    description: "Registro de evolução a cada atendimento, com anotações privadas e histórico.",
    clinical: true,
    groups: ["health", "beauty"],
  },
  attachments: {
    id: "attachments",
    label: "Anexos e exames",
    description: "Exames, laudos, fotos e documentos guardados na ficha, com criptografia.",
    clinical: true,
    groups: ["health", "beauty", "other"],
  },
  anamnesis: {
    id: "anamnesis",
    label: "Anamnese online",
    description:
      "Formulário por área enviado por link antes do primeiro atendimento e preenchido pelo próprio paciente.",
    clinical: true,
    groups: ["health", "beauty"],
  },
  recurring: {
    id: "recurring",
    label: "Agendamentos recorrentes",
    description: "Horário fixo semanal ou quinzenal, com controle de faltas.",
    clinical: false,
    groups: ["health", "beauty", "other"],
  },
  documents: {
    id: "documents",
    label: "Recibos e documentos",
    description: "Recibos para reembolso e declarações de comparecimento em PDF, com numeração.",
    clinical: false,
    groups: ["health"],
  },
  anthropometry: {
    id: "anthropometry",
    label: "Avaliação antropométrica",
    description: "Peso, IMC, circunferências e % de gordura com gráficos de evolução.",
    clinical: true,
    groups: ["health"],
    verticals: ["nutrition", "physiotherapy"],
  },
  meal_plan: {
    id: "meal_plan",
    label: "Plano alimentar",
    description: "Monte o plano por refeição e compartilhe com o paciente.",
    clinical: true,
    groups: ["health"],
    verticals: ["nutrition"],
    comingSoon: true,
  },
  odontogram: {
    id: "odontogram",
    label: "Odontograma",
    description: "Mapa interativo dos dentes com procedimentos e situação de cada um.",
    clinical: true,
    groups: ["health"],
    verticals: ["dentistry"],
  },
  treatment_plan: {
    id: "treatment_plan",
    label: "Plano de tratamento",
    description: "Orçamento por procedimento, aprovação do paciente e execução em várias sessões.",
    clinical: true,
    groups: ["health", "beauty"],
    verticals: ["dentistry", "physiotherapy", "aesthetics"],
  },
  packages: {
    id: "packages",
    label: "Pacotes de sessões",
    description: "Venda pacotes (ex.: 10 sessões) e acompanhe o saldo de cada cliente.",
    clinical: false,
    groups: ["health", "beauty"],
    verticals: ["physiotherapy", "psychology", "beauty", "aesthetics"],
    comingSoon: true,
  },
  commissions: {
    id: "commissions",
    label: "Comissões",
    description: "Percentual por profissional e por serviço, com relatório do período.",
    clinical: false,
    groups: ["beauty"],
    comingSoon: true,
  },
}

/** Módulos relevantes para uma área (os que aparecem nas configurações). */
export function modulesForVertical(vertical: VerticalId, group: VerticalGroup): ModuleDef[] {
  return Object.values(MODULES).filter(
    (m) => m.groups.includes(group) && (!m.verticals || m.verticals.includes(vertical)),
  )
}

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && (MODULE_IDS as readonly string[]).includes(value)
}

/** Remove ids desconhecidos ou ainda não implementados. */
export function sanitizeModules(ids: readonly string[]): ModuleId[] {
  return [...new Set(ids)].filter(isModuleId).filter((id) => !MODULES[id].comingSoon)
}
