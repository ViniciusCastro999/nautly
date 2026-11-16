import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assertCan, can, ForbiddenError, ROLES } from "./permissions"

describe("permissões", () => {
  it("recepção gerencia agenda e cadastro, mas não vê dado clínico", () => {
    assert.equal(can("receptionist", "agenda:manage"), true)
    assert.equal(can("receptionist", "clients:write"), true)
    assert.equal(can("receptionist", "clinical:read"), false)
    assert.equal(can("receptionist", "clinical:write"), false)
  })

  it("administrador gerencia a conta sem acessar prontuário", () => {
    assert.equal(can("admin", "settings:manage"), true)
    assert.equal(can("admin", "audit:read"), true)
    assert.equal(can("admin", "clinical:read"), false)
  })

  it("profissional acessa prontuário, mas não configura a conta", () => {
    assert.equal(can("professional", "clinical:write"), true)
    assert.equal(can("professional", "settings:manage"), false)
  })

  it("todo papel com escrita clínica também tem leitura clínica", () => {
    for (const role of ROLES) {
      if (can(role, "clinical:write")) assert.equal(can(role, "clinical:read"), true, role)
    }
  })

  it("assertCan lança ForbiddenError", () => {
    assert.throws(() => assertCan("receptionist", "clinical:read"), ForbiddenError)
    assert.doesNotThrow(() => assertCan("owner", "clinical:read"))
  })
})
