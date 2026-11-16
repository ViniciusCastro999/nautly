import { test } from "node:test"
import assert from "node:assert/strict"
import {
  applyEffect,
  DECIDUOUS_ROWS,
  HEALTHY,
  isValidTooth,
  needsTreatment,
  parseSurfaces,
  PERMANENT_ROWS,
  surfaceLabel,
  toothName,
} from "./dental"
import { canEditItems, canExecute, planTotals, statusAfterExecution } from "./treatment"
import { VERTICALS } from "./verticals"

test("arcadas FDI completas: 32 permanentes e 20 decíduos", () => {
  assert.equal(new Set(PERMANENT_ROWS.flat()).size, 32)
  assert.equal(new Set(DECIDUOUS_ROWS.flat()).size, 20)
  assert.equal(isValidTooth(36), true)
  assert.equal(isValidTooth(19), false)
  assert.equal(isValidTooth(56), false)
})

test("nome e faces de cada dente", () => {
  assert.equal(toothName(36), "Primeiro molar inferior esquerdo")
  assert.equal(toothName(11), "Incisivo central superior direito")
  assert.equal(toothName(55), "Segundo molar superior direito (decíduo)")
  assert.equal(surfaceLabel(11, "O"), "Incisal")
  assert.equal(surfaceLabel(16, "O"), "Oclusal")
  assert.equal(surfaceLabel(16, "L"), "Palatina")
  assert.equal(surfaceLabel(46, "L"), "Lingual")
})

test("parse de faces ignora letras inválidas e repetidas", () => {
  assert.deepEqual(parseSurfaces("dmo"), ["O", "M", "D"])
  assert.deepEqual(parseSurfaces("xOo"), ["O"])
  assert.deepEqual(parseSurfaces(null), [])
})

test("restauração troca cárie por restaurado só nas faces tratadas", () => {
  const before = {
    status: "healthy" as const,
    surfaces: { M: "caries" as const, O: "caries" as const, D: "caries" as const },
  }
  const after = applyEffect(before, "restoration", ["M", "O"])
  assert.deepEqual(after.surfaces, { M: "restored", O: "restored", D: "caries" })
  assert.equal(needsTreatment(after), true)
  assert.equal(needsTreatment(applyEffect(after, "restoration", ["D"])), false)
})

test("extração, implante e canal", () => {
  const decayed = { status: "extraction" as const, surfaces: { O: "caries" as const } }
  const extracted = applyEffect(decayed, "extraction", [])
  assert.deepEqual(extracted, { status: "missing", surfaces: {} })
  assert.equal(applyEffect(extracted, "implant", []).status, "implant")
  const canal = applyEffect({ status: "healthy", surfaces: { O: "restored" } }, "root_canal", [])
  assert.deepEqual(canal, { status: "root_canal", surfaces: { O: "restored" } })
  assert.equal(needsTreatment(HEALTHY), false)
})

test("totais do orçamento com desconto limitado ao subtotal", () => {
  const items = [
    { priceCents: 30_000, done: true },
    { priceCents: 120_000, done: false },
  ]
  assert.deepEqual(planTotals(items, 10_000), {
    subtotal: 150_000,
    discount: 10_000,
    total: 140_000,
    doneCount: 1,
    count: 2,
    progress: 50,
  })
  assert.equal(planTotals(items, 999_999).total, 0)
  assert.equal(planTotals([], 0).progress, 0)
})

test("ciclo do plano: edição antes da aprovação, execução depois", () => {
  assert.equal(canEditItems("draft"), true)
  assert.equal(canEditItems("approved"), false)
  assert.equal(canExecute("presented"), false)
  assert.equal(canExecute("approved"), true)
  assert.equal(statusAfterExecution("approved", true), "completed")
  assert.equal(statusAfterExecution("completed", false), "approved")
  assert.equal(statusAfterExecution("approved", false), "approved")
})

test("presets de procedimentos por dente têm efeito ou são genéricos válidos", () => {
  for (const v of Object.values(VERTICALS)) {
    for (const p of v.procedurePresets ?? []) {
      assert.ok(p.priceCents > 0, p.name)
      if (p.effect) assert.equal(p.perTooth, true, `${p.name} tem efeito mas não é por dente`)
    }
  }
})
