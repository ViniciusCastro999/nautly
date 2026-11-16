"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { EraserIcon, Loader2Icon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DECIDUOUS_ROWS,
  isUpper,
  needsTreatment,
  PERMANENT_ROWS,
  SURFACE_CONDITIONS,
  surfaceLabel,
  SURFACES,
  TOOTH_STATUSES,
  toothName,
  type Surface,
  type SurfaceCondition,
  type ToothState,
  type ToothStatus,
} from "@/lib/dental"
import { cn } from "@/lib/utils"
import { saveTooth } from "@/server/odontogram"

export type ToothView = ToothState & { notes: string | null; updatedLabel: string | null }

const EMPTY: ToothView = { status: "healthy", surfaces: {}, notes: null, updatedLabel: null }

/* -------------------------------------------------------------------------- */
/*                          Desenho de um dente (5 faces)                      */
/* -------------------------------------------------------------------------- */

/** Mesial fica do lado da linha média: à direita nos quadrantes do lado direito do paciente. */
function mesialOnRight(tooth: number) {
  return [1, 4, 5, 8].includes(Math.floor(tooth / 10))
}

function facePolygons(size: number) {
  const a = size * 0.3
  const b = size * 0.7
  const S = size
  return {
    top: `0,0 ${S},0 ${b},${a} ${a},${a}`,
    bottom: `0,${S} ${S},${S} ${b},${b} ${a},${b}`,
    left: `0,0 ${a},${a} ${a},${b} 0,${S}`,
    right: `${S},0 ${b},${a} ${b},${b} ${S},${S}`,
    center: `${a},${a} ${b},${a} ${b},${b} ${a},${b}`,
  }
}

function surfaceAt(tooth: number, position: keyof ReturnType<typeof facePolygons>): Surface {
  if (position === "center") return "O"
  if (position === "top") return isUpper(tooth) ? "V" : "L"
  if (position === "bottom") return isUpper(tooth) ? "L" : "V"
  const mesialRight = mesialOnRight(tooth)
  if (position === "right") return mesialRight ? "M" : "D"
  return mesialRight ? "D" : "M"
}

function ToothDiagram({
  tooth,
  state,
  size,
  onFaceClick,
}: {
  tooth: number
  state: ToothState
  size: number
  onFaceClick?: (surface: Surface) => void
}) {
  const polys = facePolygons(size)
  const status = TOOTH_STATUSES[state.status]
  const solid = state.status === "crown" || state.status === "implant"
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className={cn(state.status === "missing" && "opacity-40")}
      aria-hidden={!onFaceClick}
    >
      {(Object.keys(polys) as (keyof typeof polys)[]).map((pos) => {
        const surface = surfaceAt(tooth, pos)
        const condition = state.surfaces[surface]
        const fill = solid ? status.color! : condition ? SURFACE_CONDITIONS[condition].color : "var(--card)"
        return (
          <polygon
            key={pos}
            points={polys[pos]}
            fill={fill}
            fillOpacity={solid ? 0.35 : condition ? 0.9 : 1}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
            strokeWidth={1}
            className={cn(onFaceClick && "cursor-pointer transition-opacity hover:opacity-70")}
            onClick={onFaceClick ? () => onFaceClick(surface) : undefined}
          >
            {onFaceClick && <title>{surfaceLabel(tooth, surface)}</title>}
          </polygon>
        )
      })}
      {(state.status === "missing" || state.status === "extraction") && (
        <g stroke={status.color!} strokeWidth={size / 12} strokeLinecap="round" pointerEvents="none">
          <line x1={size * 0.12} y1={size * 0.12} x2={size * 0.88} y2={size * 0.88} />
          <line x1={size * 0.88} y1={size * 0.12} x2={size * 0.12} y2={size * 0.88} />
        </g>
      )}
      {state.status === "root_canal" && (
        <line
          x1={size / 2}
          y1={-1}
          x2={size / 2}
          y2={size + 1}
          stroke={status.color!}
          strokeWidth={size / 10}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
      {state.status === "fractured" && (
        <polyline
          points={`${size * 0.15},${size * 0.2} ${size * 0.45},${size * 0.45} ${size * 0.35},${size * 0.55} ${size * 0.85},${size * 0.85}`}
          fill="none"
          stroke={status.color!}
          strokeWidth={size / 14}
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Painel                                   */
/* -------------------------------------------------------------------------- */

type Tool = SurfaceCondition | "erase"

export function OdontogramPanel({
  contactId,
  canWrite,
  treatmentHref,
  teeth,
}: {
  contactId: string
  canWrite: boolean
  /** Link para a aba de tratamentos, quando o módulo está ativo. */
  treatmentHref: string | null
  teeth: Record<number, ToothView>
}) {
  const router = useRouter()
  const hasDeciduous = Object.keys(teeth).some((t) => Number(t) >= 50)
  const [dentition, setDentition] = useState<"permanent" | "deciduous">(
    hasDeciduous ? "deciduous" : "permanent",
  )
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState<ToothView>(EMPTY)
  const [tool, setTool] = useState<Tool>("caries")
  const [pending, startTransition] = useTransition()

  const rows = dentition === "permanent" ? PERMANENT_ROWS : DECIDUOUS_ROWS
  const stateOf = (t: number) => (t === selected ? draft : (teeth[t] ?? EMPTY))

  function select(t: number) {
    setSelected(t)
    setDraft(teeth[t] ?? EMPTY)
  }

  function paint(surface: Surface) {
    if (!canWrite) return
    setDraft((d) => {
      const surfaces = { ...d.surfaces }
      if (tool === "erase" || surfaces[surface] === tool) delete surfaces[surface]
      else surfaces[surface] = tool
      // Marcar uma face num dente ausente/coroa volta o dente para hígido.
      const status = ["missing", "crown", "implant"].includes(d.status) ? "healthy" : d.status
      return { ...d, status, surfaces }
    })
  }

  function save() {
    if (selected === null) return
    startTransition(async () => {
      const res = await saveTooth({
        contactId,
        tooth: selected,
        status: draft.status,
        surfaces: draft.surfaces,
        notes: draft.notes ?? "",
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Dente ${selected} atualizado`)
      router.refresh()
    })
  }

  const summary = Object.values(teeth).reduce(
    (acc, t) => {
      for (const c of Object.values(t.surfaces)) acc[c] = (acc[c] ?? 0) + 1
      if (t.status !== "healthy") acc[t.status] = (acc[t.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const pendingTeeth = Object.entries(teeth)
    .filter(([, t]) => needsTreatment(t))
    .map(([n]) => Number(n))
  const dirty = selected !== null && JSON.stringify(draft) !== JSON.stringify(teeth[selected] ?? EMPTY)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="min-w-0 rounded-xl border bg-card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Odontograma</h2>
            <p className="text-sm text-muted-foreground">
              {pendingTeeth.length
                ? `${pendingTeeth.length} ${pendingTeeth.length === 1 ? "dente precisa" : "dentes precisam"} de tratamento: ${pendingTeeth.join(", ")}`
                : "Clique em um dente para registrar a situação."}
            </p>
          </div>
          <div className="inline-flex rounded-full border p-0.5">
            {(["permanent", "deciduous"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDentition(d)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
                  dentition === d ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {d === "permanent" ? "Permanente" : "Decídua"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="mx-auto grid w-fit gap-6">
            {rows.map((row, r) => (
              <div key={r} className="flex">
                {row.map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => select(t)}
                    aria-label={`Dente ${t}: ${toothName(t)}`}
                    aria-pressed={selected === t}
                    className={cn(
                      "flex shrink-0 flex-col items-center gap-1 rounded-md px-0.5 py-1 transition-colors hover:bg-muted",
                      r === 1 && "flex-col-reverse",
                      selected === t && "bg-accent ring-2 ring-primary",
                      i === row.length / 2 && "ml-3 border-l pl-3",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        needsTreatment(stateOf(t)) ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {t}
                    </span>
                    <ToothDiagram tooth={t} state={stateOf(t)} size={30} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
          {Object.entries(SURFACE_CONDITIONS).map(([key, c]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ backgroundColor: c.color }} />
              {c.label}
              {summary[key] ? <strong className="text-foreground">({summary[key]})</strong> : null}
            </span>
          ))}
          {Object.entries(TOOTH_STATUSES)
            .filter(([, s]) => s.color)
            .map(([key, s]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="size-3 rounded-full border-2" style={{ borderColor: s.color! }} />
                {s.label}
                {summary[key] ? <strong className="text-foreground">({summary[key]})</strong> : null}
              </span>
            ))}
        </div>
      </section>

      <aside className="h-fit rounded-xl border bg-card p-5">
        {selected === null ? (
          <p className="text-sm text-muted-foreground">
            Selecione um dente no odontograma para ver e editar a situação de cada face.
          </p>
        ) : (
          <div className="grid gap-5">
            <div>
              <p className="text-2xl font-bold tabular-nums">{selected}</p>
              <p className="text-sm text-muted-foreground">{toothName(selected)}</p>
              {teeth[selected]?.updatedLabel && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Atualizado {teeth[selected].updatedLabel}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <ToothDiagram
                tooth={selected}
                state={draft}
                size={96}
                onFaceClick={canWrite ? paint : undefined}
              />
              <ul className="grid gap-1 text-xs">
                {SURFACES.map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <span className="w-4 font-bold">{s}</span>
                    <span className="text-muted-foreground">{surfaceLabel(selected, s)}</span>
                    {draft.surfaces[s] && (
                      <span
                        className="font-medium"
                        style={{ color: SURFACE_CONDITIONS[draft.surfaces[s]!].color }}
                      >
                        {SURFACE_CONDITIONS[draft.surfaces[s]!].label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {canWrite && (
              <>
                <div className="grid gap-2">
                  <Label>Marcar faces como</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(SURFACE_CONDITIONS) as SurfaceCondition[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTool(c)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          tool === c ? "border-primary bg-accent" : "hover:bg-muted",
                        )}
                      >
                        <span
                          className="size-2.5 rounded-sm"
                          style={{ backgroundColor: SURFACE_CONDITIONS[c].color }}
                        />
                        {SURFACE_CONDITIONS[c].label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTool("erase")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                        tool === "erase" ? "border-primary bg-accent" : "hover:bg-muted",
                      )}
                    >
                      <EraserIcon className="size-3" /> Limpar
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Depois clique nas faces do dente acima.</p>
                </div>

                <div className="grid gap-2">
                  <Label>Situação do dente</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(TOOTH_STATUSES) as ToothStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            status: s,
                            surfaces: ["missing", "crown", "implant"].includes(s) ? {} : d.surfaces,
                          }))
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          draft.status === s ? "border-primary bg-accent" : "hover:bg-muted",
                        )}
                      >
                        {TOOTH_STATUSES[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tooth-notes">Observações</Label>
                  <Textarea
                    id="tooth-notes"
                    value={draft.notes ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    placeholder="Ex.: sensibilidade ao frio"
                    className="min-h-16"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-full" disabled={pending || !dirty} onClick={save}>
                    {pending && <Loader2Icon className="animate-spin" />}
                    Salvar dente {selected}
                  </Button>
                  {treatmentHref && needsTreatment(draft) && (
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href={`${treatmentHref}&tooth=${selected}`}>
                        <PlusIcon /> Orçar tratamento
                      </Link>
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
