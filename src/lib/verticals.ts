/**
 * Áreas de atuação ("verticais"). Cada área é um preset: define vocabulário,
 * módulos ligados por padrão e tipos de evento iniciais. A pessoa pode
 * ligar/desligar módulos depois; a área só muda o ponto de partida.
 */
import type { ModuleId } from "./modules"

export const VERTICAL_IDS = [
  "psychology",
  "nutrition",
  "dentistry",
  "medicine",
  "physiotherapy",
  "beauty",
  "aesthetics",
  "other",
] as const
export type VerticalId = (typeof VERTICAL_IDS)[number]

export type VerticalGroup = "health" | "beauty" | "other"

export type Vocabulary = {
  client: string
  clients: string
  /** Nome do atendimento: "sessão", "consulta", "atendimento". */
  appointment: string
  appointments: string
}

type EventPreset = {
  title: string
  slug: string
  durationMinutes: number
  locationType: "video" | "phone" | "in_person"
  color: string
  description: string
  bufferAfterMinutes?: number
}

export type ProcedurePreset = {
  name: string
  priceCents: number
  effect?: import("./dental").ProcedureEffect
  perTooth?: boolean
}

export type Vertical = {
  id: VerticalId
  label: string
  group: VerticalGroup
  description: string
  /** Nome do registro profissional (CRP, CRN...). */
  registryLabel?: string
  vocabulary: Vocabulary
  defaultModules: ModuleId[]
  eventPresets: EventPreset[]
  /** Catálogo inicial de procedimentos (módulo de plano de tratamento). */
  procedurePresets?: ProcedurePreset[]
}

const PATIENT: Vocabulary = {
  client: "paciente",
  clients: "Pacientes",
  appointment: "consulta",
  appointments: "Consultas",
}
const CLIENT: Vocabulary = {
  client: "cliente",
  clients: "Clientes",
  appointment: "atendimento",
  appointments: "Atendimentos",
}

export const VERTICALS: Record<VerticalId, Vertical> = {
  psychology: {
    id: "psychology",
    label: "Psicologia",
    group: "health",
    description: "Sessões recorrentes, prontuário e anotações privadas.",
    registryLabel: "CRP",
    vocabulary: { ...PATIENT, appointment: "sessão", appointments: "Sessões" },
    defaultModules: ["records", "attachments", "anamnesis", "recurring", "documents"],
    eventPresets: [
      {
        title: "Primeira sessão",
        slug: "primeira-sessao",
        durationMinutes: 50,
        locationType: "in_person",
        color: "#8247f5",
        description: "Primeiro encontro para nos conhecermos e entender sua demanda.",
        bufferAfterMinutes: 10,
      },
      {
        title: "Sessão online",
        slug: "sessao-online",
        durationMinutes: 50,
        locationType: "video",
        color: "#1b6a8a",
        description: "Sessão de psicoterapia por videochamada.",
        bufferAfterMinutes: 10,
      },
    ],
  },
  nutrition: {
    id: "nutrition",
    label: "Nutrição",
    group: "health",
    description: "Avaliação, evolução de medidas e plano alimentar.",
    registryLabel: "CRN",
    vocabulary: PATIENT,
    defaultModules: ["records", "attachments", "anamnesis", "anthropometry", "documents"],
    eventPresets: [
      {
        title: "Consulta inicial",
        slug: "consulta-inicial",
        durationMinutes: 60,
        locationType: "in_person",
        color: "#0ab39c",
        description:
          "Anamnese completa, avaliação corporal e definição de objetivos. Traga seus exames recentes.",
      },
      {
        title: "Retorno",
        slug: "retorno",
        durationMinutes: 30,
        locationType: "in_person",
        color: "#17e885",
        description: "Acompanhamento da evolução e ajustes no plano alimentar.",
      },
    ],
  },
  dentistry: {
    id: "dentistry",
    label: "Odontologia",
    group: "health",
    description: "Odontograma, planos de tratamento e radiografias.",
    registryLabel: "CRO",
    vocabulary: PATIENT,
    defaultModules: ["records", "attachments", "anamnesis", "odontogram", "treatment_plan", "documents"],
    procedurePresets: [
      { name: "Consulta de avaliação", priceCents: 15_000 },
      { name: "Profilaxia (limpeza)", priceCents: 25_000 },
      { name: "Restauração em resina", priceCents: 30_000, effect: "restoration", perTooth: true },
      { name: "Selante", priceCents: 12_000, effect: "sealant", perTooth: true },
      { name: "Tratamento de canal", priceCents: 120_000, effect: "root_canal", perTooth: true },
      { name: "Extração simples", priceCents: 25_000, effect: "extraction", perTooth: true },
      { name: "Coroa de porcelana", priceCents: 180_000, effect: "crown", perTooth: true },
      { name: "Implante unitário", priceCents: 350_000, effect: "implant", perTooth: true },
      { name: "Clareamento a laser", priceCents: 90_000 },
    ],
    eventPresets: [
      {
        title: "Avaliação",
        slug: "avaliacao",
        durationMinutes: 30,
        locationType: "in_person",
        color: "#3f9fbf",
        description: "Avaliação clínica e orientação sobre o tratamento.",
      },
      {
        title: "Limpeza",
        slug: "limpeza",
        durationMinutes: 45,
        locationType: "in_person",
        color: "#1b6a8a",
        description: "Profilaxia e aplicação de flúor.",
      },
    ],
  },
  medicine: {
    id: "medicine",
    label: "Medicina",
    group: "health",
    description: "Prontuário, exames anexados e documentos médicos.",
    registryLabel: "CRM",
    vocabulary: PATIENT,
    defaultModules: ["records", "attachments", "anamnesis", "documents"],
    eventPresets: [
      {
        title: "Consulta",
        slug: "consulta",
        durationMinutes: 30,
        locationType: "in_person",
        color: "#1b6a8a",
        description: "Consulta médica.",
      },
      {
        title: "Teleconsulta",
        slug: "teleconsulta",
        durationMinutes: 20,
        locationType: "video",
        color: "#8247f5",
        description: "Consulta por videochamada.",
      },
    ],
  },
  physiotherapy: {
    id: "physiotherapy",
    label: "Fisioterapia",
    group: "health",
    description: "Avaliação, evolução por sessão e pacotes.",
    registryLabel: "CREFITO",
    vocabulary: { ...PATIENT, appointment: "sessão", appointments: "Sessões" },
    defaultModules: [
      "records",
      "attachments",
      "anamnesis",
      "recurring",
      "anthropometry",
      "treatment_plan",
      "documents",
    ],
    procedurePresets: [
      { name: "Avaliação fisioterapêutica", priceCents: 18_000 },
      { name: "Sessão de fisioterapia", priceCents: 12_000 },
      { name: "RPG", priceCents: 15_000 },
      { name: "Pilates clínico", priceCents: 10_000 },
    ],
    eventPresets: [
      {
        title: "Avaliação fisioterapêutica",
        slug: "avaliacao",
        durationMinutes: 60,
        locationType: "in_person",
        color: "#0ab39c",
        description: "Avaliação inicial e definição do plano de tratamento.",
      },
      {
        title: "Sessão",
        slug: "sessao",
        durationMinutes: 50,
        locationType: "in_person",
        color: "#1b6a8a",
        description: "Sessão de fisioterapia.",
      },
    ],
  },
  beauty: {
    id: "beauty",
    label: "Salão e barbearia",
    group: "beauty",
    description: "Serviços, profissionais da equipe e histórico de cada cliente.",
    vocabulary: CLIENT,
    defaultModules: ["attachments", "recurring"],
    eventPresets: [
      {
        title: "Corte",
        slug: "corte",
        durationMinutes: 40,
        locationType: "in_person",
        color: "#ff4f00",
        description: "Corte com lavagem e finalização.",
      },
      {
        title: "Corte e barba",
        slug: "corte-e-barba",
        durationMinutes: 60,
        locationType: "in_person",
        color: "#ffa600",
        description: "Corte completo e barba com toalha quente.",
      },
    ],
  },
  aesthetics: {
    id: "aesthetics",
    label: "Estética",
    group: "beauty",
    description: "Procedimentos, fotos de antes e depois e ficha do cliente.",
    vocabulary: CLIENT,
    defaultModules: ["records", "attachments", "anamnesis", "treatment_plan"],
    procedurePresets: [
      { name: "Limpeza de pele", priceCents: 18_000 },
      { name: "Peeling químico", priceCents: 30_000 },
      { name: "Microagulhamento", priceCents: 45_000 },
      { name: "Drenagem linfática", priceCents: 15_000 },
    ],
    eventPresets: [
      {
        title: "Avaliação estética",
        slug: "avaliacao",
        durationMinutes: 30,
        locationType: "in_person",
        color: "#e55cff",
        description: "Avaliação e indicação do procedimento mais adequado.",
      },
      {
        title: "Limpeza de pele",
        slug: "limpeza-de-pele",
        durationMinutes: 60,
        locationType: "in_person",
        color: "#8247f5",
        description: "Limpeza de pele profunda.",
      },
    ],
  },
  other: {
    id: "other",
    label: "Outra área",
    group: "other",
    description: "Agenda, página de agendamento e cadastro de clientes.",
    vocabulary: { ...CLIENT, appointment: "agendamento", appointments: "Agendamentos" },
    defaultModules: [],
    eventPresets: [
      {
        title: "Reunião de 30 minutos",
        slug: "30min",
        durationMinutes: 30,
        locationType: "video",
        color: "#1b6a8a",
        description: "Uma conversa rápida.",
      },
    ],
  },
}

export const VERTICAL_GROUPS: { id: VerticalGroup; label: string; verticals: VerticalId[] }[] = [
  {
    id: "health",
    label: "Saúde",
    verticals: ["psychology", "nutrition", "dentistry", "medicine", "physiotherapy"],
  },
  { id: "beauty", label: "Beleza e bem-estar", verticals: ["beauty", "aesthetics"] },
  { id: "other", label: "Outros", verticals: ["other"] },
]

export function getVertical(id: string | null | undefined): Vertical {
  return VERTICALS[(id as VerticalId) ?? "other"] ?? VERTICALS.other
}

export function isVerticalId(value: unknown): value is VerticalId {
  return typeof value === "string" && (VERTICAL_IDS as readonly string[]).includes(value)
}
