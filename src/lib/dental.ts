/**
 * Odontograma: numeração FDI, situação de cada dente e faces, e o efeito que
 * um procedimento concluído tem sobre o dente.
 */

/** Ordem de exibição (visão do profissional de frente para o paciente). */
export const PERMANENT_ROWS = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
] as const

export const DECIDUOUS_ROWS = [
  [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
] as const

const ALL_TEETH = new Set<number>([...PERMANENT_ROWS.flat(), ...DECIDUOUS_ROWS.flat()])

export function isValidTooth(n: unknown): n is number {
  return typeof n === "number" && ALL_TEETH.has(n)
}

export function isDeciduous(tooth: number) {
  return Math.floor(tooth / 10) >= 5
}

export function isUpper(tooth: number) {
  return [1, 2, 5, 6].includes(Math.floor(tooth / 10))
}

/** Incisivos e caninos: a face oclusal se chama incisal. */
export function isAnterior(tooth: number) {
  return tooth % 10 <= 3
}

const QUADRANT = ["", "superior direito", "superior esquerdo", "inferior esquerdo", "inferior direito"]
const PERMANENT_NAMES = [
  "",
  "Incisivo central",
  "Incisivo lateral",
  "Canino",
  "Primeiro pré-molar",
  "Segundo pré-molar",
  "Primeiro molar",
  "Segundo molar",
  "Terceiro molar",
]
const DECIDUOUS_NAMES = [
  "",
  "Incisivo central",
  "Incisivo lateral",
  "Canino",
  "Primeiro molar",
  "Segundo molar",
]

/** 36 → "Primeiro molar inferior esquerdo". */
export function toothName(tooth: number) {
  const q = Math.floor(tooth / 10)
  const pos = tooth % 10
  const deciduous = q >= 5
  const name = (deciduous ? DECIDUOUS_NAMES : PERMANENT_NAMES)[pos]
  return `${name} ${QUADRANT[deciduous ? q - 4 : q]}${deciduous ? " (decíduo)" : ""}`
}

export const SURFACES = ["O", "M", "D", "V", "L"] as const
export type Surface = (typeof SURFACES)[number]

export function surfaceLabel(tooth: number, s: Surface) {
  switch (s) {
    case "O":
      return isAnterior(tooth) ? "Incisal" : "Oclusal"
    case "M":
      return "Mesial"
    case "D":
      return "Distal"
    case "V":
      return "Vestibular"
    case "L":
      return isUpper(tooth) ? "Palatina" : "Lingual"
  }
}

/** "mod" → ["M", "O", "D"] (sem repetição, na ordem canônica). Letras inválidas são ignoradas. */
export function parseSurfaces(input: string | null | undefined): Surface[] {
  const letters = new Set((input ?? "").toUpperCase().split(""))
  return SURFACES.filter((s) => letters.has(s))
}

export const TOOTH_STATUSES = {
  healthy: { label: "Hígido", color: null },
  missing: { label: "Ausente", color: "#94a3b8" },
  extraction: { label: "Extração indicada", color: "#ef4444" },
  root_canal: { label: "Tratamento de canal", color: "#a855f7" },
  crown: { label: "Coroa", color: "#f59e0b" },
  implant: { label: "Implante", color: "#0ea5e9" },
  fractured: { label: "Fraturado", color: "#f97316" },
} as const
export type ToothStatus = keyof typeof TOOTH_STATUSES

export const SURFACE_CONDITIONS = {
  caries: { label: "Cárie", color: "#ef4444" },
  restored: { label: "Restaurado", color: "#2563eb" },
  sealant: { label: "Selante", color: "#16a34a" },
} as const
export type SurfaceCondition = keyof typeof SURFACE_CONDITIONS

export function isToothStatus(v: unknown): v is ToothStatus {
  return typeof v === "string" && v in TOOTH_STATUSES
}
export function isSurfaceCondition(v: unknown): v is SurfaceCondition {
  return typeof v === "string" && v in SURFACE_CONDITIONS
}

export const PROCEDURE_EFFECTS = {
  restoration: "Restaura as faces indicadas",
  sealant: "Aplica selante nas faces indicadas",
  root_canal: "Marca tratamento de canal",
  extraction: "Marca o dente como ausente",
  crown: "Marca coroa",
  implant: "Marca implante",
} as const
export type ProcedureEffect = keyof typeof PROCEDURE_EFFECTS

export function isProcedureEffect(v: unknown): v is ProcedureEffect {
  return typeof v === "string" && v in PROCEDURE_EFFECTS
}

export type ToothState = { status: ToothStatus; surfaces: Partial<Record<Surface, SurfaceCondition>> }

export const HEALTHY: ToothState = { status: "healthy", surfaces: {} }

/**
 * Situação do dente depois de concluir um procedimento. Ex.: restauração MO
 * em um dente com cárie em M e O deixa as duas faces restauradas.
 */
export function applyEffect(current: ToothState, effect: ProcedureEffect, surfaces: Surface[]): ToothState {
  switch (effect) {
    case "restoration":
    case "sealant": {
      const condition: SurfaceCondition = effect === "restoration" ? "restored" : "sealant"
      const next = { ...current.surfaces }
      for (const s of surfaces) next[s] = condition
      // Um dente fraturado restaurado volta a ser considerado hígido (com restaurações).
      const status = current.status === "fractured" && effect === "restoration" ? "healthy" : current.status
      return { status, surfaces: next }
    }
    case "extraction":
      return { status: "missing", surfaces: {} }
    case "implant":
      return { status: "implant", surfaces: {} }
    case "crown":
      return { status: "crown", surfaces: {} }
    case "root_canal":
      return { ...current, status: "root_canal" }
  }
}

/** Faces com cárie ou dente com indicação: sugere procedimentos no orçamento. */
export function needsTreatment(state: ToothState) {
  return (
    state.status === "extraction" ||
    state.status === "fractured" ||
    Object.values(state.surfaces).includes("caries")
  )
}
