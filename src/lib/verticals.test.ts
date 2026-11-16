import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MODULES, modulesForVertical, sanitizeModules } from "./modules"
import { getVertical, VERTICAL_GROUPS, VERTICAL_IDS, VERTICALS } from "./verticals"

describe("áreas e módulos", () => {
  it("toda área aparece em exatamente um grupo do cadastro", () => {
    const listed = VERTICAL_GROUPS.flatMap((g) => g.verticals)
    assert.deepEqual([...listed].sort(), [...VERTICAL_IDS].sort())
  })

  it("módulos padrão de cada área existem, estão prontos e fazem sentido para ela", () => {
    for (const v of Object.values(VERTICALS)) {
      const allowed = new Set(modulesForVertical(v.id, v.group).map((m) => m.id))
      for (const id of v.defaultModules) {
        assert.ok(MODULES[id], `${v.id}: módulo ${id} inexistente`)
        assert.ok(!MODULES[id].comingSoon, `${v.id}: ${id} ainda não está pronto`)
        assert.ok(allowed.has(id), `${v.id}: ${id} não é oferecido para a área`)
      }
    }
  })

  it("slugs dos eventos iniciais são únicos por área", () => {
    for (const v of Object.values(VERTICALS)) {
      const slugs = v.eventPresets.map((e) => e.slug)
      assert.equal(new Set(slugs).size, slugs.length, v.id)
    }
  })

  it("módulos específicos não aparecem em outras áreas (sem poluir a tela)", () => {
    const beauty = modulesForVertical("beauty", "beauty").map((m) => m.id)
    assert.ok(!beauty.includes("odontogram"))
    assert.ok(!beauty.includes("meal_plan"))
    const psychology = modulesForVertical("psychology", "health").map((m) => m.id)
    assert.ok(!psychology.includes("odontogram"))
    assert.ok(modulesForVertical("dentistry", "health").some((m) => m.id === "odontogram"))
  })

  it("sanitizeModules remove ids desconhecidos, duplicados e ainda não implementados", () => {
    assert.deepEqual(sanitizeModules(["records", "records", "foo", "meal_plan", "attachments"]), [
      "records",
      "attachments",
    ])
  })

  it("área desconhecida cai no genérico", () => {
    assert.equal(getVertical("xyz").id, "other")
    assert.equal(getVertical(null).id, "other")
  })
})
