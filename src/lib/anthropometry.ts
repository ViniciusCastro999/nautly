/** Cálculos e metadados da avaliação antropométrica. */

export type MeasurementValues = {
  weightKg: number | null
  heightCm: number | null
  waistCm: number | null
  hipCm: number | null
  bodyFatPct: number | null
  muscleMassKg: number | null
}

export type MetricKey = keyof MeasurementValues | "bmi"

export const METRICS: Record<
  MetricKey,
  { label: string; unit: string; decimals: number; min: number; max: number }
> = {
  weightKg: { label: "Peso", unit: "kg", decimals: 1, min: 1, max: 400 },
  heightCm: { label: "Altura", unit: "cm", decimals: 0, min: 40, max: 250 },
  bmi: { label: "IMC", unit: "kg/m²", decimals: 1, min: 0, max: 0 },
  waistCm: { label: "Cintura", unit: "cm", decimals: 1, min: 20, max: 300 },
  hipCm: { label: "Quadril", unit: "cm", decimals: 1, min: 20, max: 300 },
  bodyFatPct: { label: "Gordura corporal", unit: "%", decimals: 1, min: 1, max: 80 },
  muscleMassKg: { label: "Massa muscular", unit: "kg", decimals: 1, min: 1, max: 200 },
}

/** Campos digitados no formulário (o IMC é calculado). */
export const INPUT_METRICS = [
  "weightKg",
  "heightCm",
  "waistCm",
  "hipCm",
  "bodyFatPct",
  "muscleMassKg",
] as const

export function bmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** Classificação do IMC para adultos (OMS). */
export function bmiCategory(value: number | null) {
  if (value === null) return null
  if (value < 18.5) return { label: "Abaixo do peso", tone: "warning" as const }
  if (value < 25) return { label: "Peso adequado", tone: "ok" as const }
  if (value < 30) return { label: "Sobrepeso", tone: "warning" as const }
  if (value < 35) return { label: "Obesidade grau I", tone: "danger" as const }
  if (value < 40) return { label: "Obesidade grau II", tone: "danger" as const }
  return { label: "Obesidade grau III", tone: "danger" as const }
}

export function waistHipRatio(waistCm: number | null, hipCm: number | null) {
  if (!waistCm || !hipCm) return null
  return Math.round((waistCm / hipCm) * 100) / 100
}

/** Valor de uma métrica, incluindo a calculada (IMC). Altura ausente usa a última conhecida. */
export function metricValue(m: MeasurementValues, key: MetricKey, fallbackHeight?: number | null) {
  if (key === "bmi") return bmi(m.weightKg, m.heightCm ?? fallbackHeight ?? null)
  return m[key]
}

export function formatMetric(key: MetricKey, value: number | null) {
  if (value === null) return "-"
  const { decimals, unit } = METRICS[key]
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`
}

/** Diferença entre duas avaliações, arredondada para a precisão da métrica. */
export function delta(key: MetricKey, current: number | null, previous: number | null) {
  if (current === null || previous === null) return null
  const factor = 10 ** METRICS[key].decimals
  return Math.round((current - previous) * factor) / factor
}
