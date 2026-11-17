"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Loader2Icon, PlusIcon, RulerIcon, Trash2Icon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  bmiCategory,
  delta,
  formatMetric,
  INPUT_METRICS,
  METRICS,
  metricValue,
  waistHipRatio,
  type MeasurementValues,
  type MetricKey,
} from "@/lib/anthropometry"
import { cn } from "@/lib/utils"
import { createMeasurement, deleteMeasurement } from "@/server/measurements"

export type MeasurementView = MeasurementValues & {
  id: string
  measuredOn: string
  label: string
  isMine: boolean
}

const CHART_METRICS: MetricKey[] = ["weightKg", "bmi", "waistCm", "hipCm", "bodyFatPct", "muscleMassKg"]

export function MeasurementsPanel({
  contactId,
  canWrite,
  today,
  measurements,
}: {
  contactId: string
  canWrite: boolean
  today: string
  /** Em ordem cronológica. */
  measurements: MeasurementView[]
}) {
  // Última altura conhecida, para calcular o IMC de avaliações sem altura.
  const withHeight = useMemo(
    () =>
      measurements.map((m, i) => ({
        ...m,
        effectiveHeight:
          measurements
            .slice(0, i + 1)
            .reverse()
            .find((x) => x.heightCm !== null)?.heightCm ?? null,
      })),
    [measurements],
  )

  const available = CHART_METRICS.filter((k) =>
    withHeight.some((m) => metricValue(m, k, m.effectiveHeight) !== null),
  )
  const [metric, setMetric] = useState<MetricKey>(available[0] ?? "weightKg")
  const active = available.includes(metric) ? metric : (available[0] ?? "weightKg")

  const first = withHeight[0]
  const last = withHeight.at(-1)
  // Valores conhecidos de cada medida (uma avaliação pode ter só o peso, por exemplo).
  const known = (key: MetricKey) =>
    withHeight.map((m) => metricValue(m, key, m.effectiveHeight)).filter((v): v is number => v !== null)
  const weights = known("weightKg")
  const waists = known("waistCm")
  const latestWithRatio = [...withHeight].reverse().find((m) => waistHipRatio(m.waistCm, m.hipCm) !== null)
  const latestFat = known("bodyFatPct").at(-1) ?? null

  const chartData = withHeight
    .map((m) => ({ date: m.label.slice(0, 5), value: metricValue(m, active, m.effectiveHeight) }))
    .filter((d) => d.value !== null)
  const chartConfig = {
    value: { label: METRICS[active].label, color: "var(--primary)" },
  } satisfies ChartConfig

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Avaliação antropométrica</h2>
          <p className="text-sm text-muted-foreground">
            {measurements.length
              ? `${measurements.length} ${measurements.length === 1 ? "avaliação" : "avaliações"} desde ${first?.label}`
              : "Registre a primeira avaliação para acompanhar a evolução."}
          </p>
        </div>
        {canWrite && (
          <NewMeasurementDialog
            contactId={contactId}
            today={today}
            lastHeight={last?.effectiveHeight ?? null}
          />
        )}
      </div>

      {last && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Peso atual"
            value={formatMetric("weightKg", weights.at(-1) ?? null)}
            change={delta("weightKg", weights.at(-1) ?? null, weights[0] ?? null)}
            changeLabel="desde o início"
            unit="kg"
            lowerIsBetter
          />
          <SummaryCard
            label="IMC"
            value={formatMetric("bmi", known("bmi").at(-1) ?? null)}
            badge={bmiCategory(known("bmi").at(-1) ?? null)}
          />
          <SummaryCard
            label="Cintura"
            value={formatMetric("waistCm", waists.at(-1) ?? null)}
            change={delta("waistCm", waists.at(-1) ?? null, waists.at(-2) ?? null)}
            changeLabel="desde a anterior"
            unit="cm"
            lowerIsBetter
          />
          <SummaryCard
            label="Relação cintura/quadril"
            value={
              latestWithRatio
                ? waistHipRatio(latestWithRatio.waistCm, latestWithRatio.hipCm)!.toLocaleString("pt-BR")
                : "-"
            }
            hint={latestFat !== null ? `Gordura: ${formatMetric("bodyFatPct", latestFat)}` : undefined}
          />
        </div>
      )}

      {chartData.length > 0 && (
        <section className="rounded-[13px] border bg-card p-5">
          <div className="mb-4 flex flex-wrap gap-1">
            {available.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetric(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
                  active === k
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {METRICS[k].label}
              </button>
            ))}
          </div>
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => (
                      <span className="font-semibold tabular-nums">{formatMetric(active, Number(v))}</span>
                    )}
                  />
                }
              />
              <Line
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--color-value)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </section>
      )}

      {measurements.length > 0 && (
        <section className="overflow-x-auto rounded-[13px] border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Data</th>
                {(["weightKg", "bmi", "waistCm", "hipCm", "bodyFatPct", "muscleMassKg"] as MetricKey[]).map(
                  (k) => (
                    <th key={k} className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                      {METRICS[k].label}
                    </th>
                  ),
                )}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...withHeight].reverse().map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 font-medium tabular-nums">{m.label}</td>
                  {(["weightKg", "bmi", "waistCm", "hipCm", "bodyFatPct", "muscleMassKg"] as MetricKey[]).map(
                    (k) => (
                      <td key={k} className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                        {formatMetric(k, metricValue(m, k, m.effectiveHeight))}
                      </td>
                    ),
                  )}
                  <td className="px-2">{canWrite && m.isMine && <DeleteMeasurementButton id={m.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function SummaryCard(props: {
  label: string
  value: string
  change?: number | null
  changeLabel?: string
  unit?: string
  lowerIsBetter?: boolean
  badge?: { label: string; tone: "ok" | "warning" | "danger" } | null
  hint?: string
}) {
  const change = props.change ?? null
  const good = change !== null && change !== 0 && (props.lowerIsBetter ? change < 0 : change > 0)
  return (
    <div className="rounded-[13px] border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{props.value}</p>
      {change !== null && change !== 0 && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            good ? "text-success" : "text-muted-foreground",
          )}
        >
          {change < 0 ? <TrendingDownIcon className="size-3.5" /> : <TrendingUpIcon className="size-3.5" />}
          {change > 0 ? "+" : ""}
          {change.toLocaleString("pt-BR")} {props.unit} {props.changeLabel}
        </p>
      )}
      {props.badge && (
        <Badge
          variant="outline"
          className={cn(
            "mt-1.5",
            props.badge.tone === "ok" && "border-success text-success",
            props.badge.tone === "warning" && "border-amber-500 text-amber-600 dark:text-amber-400",
            props.badge.tone === "danger" && "border-destructive text-destructive",
          )}
        >
          {props.badge.label}
        </Badge>
      )}
      {props.hint && <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  )
}

function NewMeasurementDialog({
  contactId,
  today,
  lastHeight,
}: {
  contactId: string
  today: string
  lastHeight: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setError(null)
    startTransition(async () => {
      const res = await createMeasurement({ ...form, contactId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      toast.success("Avaliação registrada")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> Nova avaliação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RulerIcon className="size-5 text-primary" /> Nova avaliação
          </DialogTitle>
          <DialogDescription>
            Preencha só o que foi medido. O IMC é calculado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 grid gap-2 sm:col-span-1">
            <Label htmlFor="m-date">Data</Label>
            <Input id="m-date" name="measuredOn" type="date" defaultValue={today} required className="h-10" />
          </div>
          {INPUT_METRICS.map((k) => (
            <div key={k} className="grid gap-2">
              <Label htmlFor={`m-${k}`}>
                {METRICS[k].label}{" "}
                <span className="font-normal text-muted-foreground">({METRICS[k].unit})</span>
              </Label>
              <Input
                id={`m-${k}`}
                name={k}
                inputMode="decimal"
                defaultValue={k === "heightCm" && lastHeight ? String(lastHeight) : undefined}
                className="h-10"
              />
            </div>
          ))}
          {error && <p className="col-span-2 text-sm text-destructive">{error}</p>}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Salvar avaliação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteMeasurementButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground"
      aria-label="Remover avaliação"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remover esta avaliação? Use apenas para corrigir lançamentos errados.")) return
        startTransition(async () => {
          await deleteMeasurement(id)
          router.refresh()
        })
      }}
    >
      <Trash2Icon className="size-4" />
    </Button>
  )
}
