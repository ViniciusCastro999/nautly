import { test } from "node:test"
import assert from "node:assert/strict"
import { TEMPLATES, templateForVertical, validateAnswers } from "./anamnesis"
import { VERTICAL_IDS } from "./verticals"

test("toda área tem um modelo e ids de campo são únicos por modelo", () => {
  for (const v of VERTICAL_IDS) assert.ok(templateForVertical(v))
  for (const t of Object.values(TEMPLATES)) {
    const ids = t.sections.flatMap((s) => s.fields.map((f) => f.id))
    assert.equal(new Set(ids).size, ids.length, `ids repetidos em ${t.id}`)
  }
})

test("exige campos obrigatórios", () => {
  const res = validateAnswers(TEMPLATES.nutrition, {})
  assert.equal(res.ok, false)
  if (!res.ok) assert.ok(res.errors.goal)
})

test("descarta campos desconhecidos, opções inválidas de múltipla escolha e normaliza números", () => {
  const res = validateAnswers(TEMPLATES.nutrition, {
    goal: "Emagrecimento",
    water: "2,5",
    restrictions: ["Sem lactose", "Inventado", "Sem lactose"],
    hacker: "<script>",
  })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.answers.water, "2.5")
    assert.deepEqual(res.answers.restrictions, ["Sem lactose"])
    assert.equal("hacker" in res.answers, false)
  }
})

test("recusa opção fora da lista", () => {
  const res = validateAnswers(TEMPLATES.nutrition, { goal: "Ficar rico" })
  assert.equal(res.ok, false)
})

test("remove respostas de campos condicionais ocultos", () => {
  const res = validateAnswers(TEMPLATES.nutrition, {
    goal: "Saúde e exames",
    medications: "Não",
    medications_detail: "não deveria ficar",
  })
  assert.equal(res.ok, true)
  if (res.ok) assert.equal("medications_detail" in res.answers, false)
})
