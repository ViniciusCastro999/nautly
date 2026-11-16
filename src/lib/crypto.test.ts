import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { describe, it } from "node:test"

import { decryptBuffer, decryptText, encryptBuffer, encryptText } from "./crypto"

// A chave é lida a cada chamada, então basta defini-la antes dos testes.
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64")

describe("criptografia de dados sensíveis", () => {
  it("criptografa e descriptografa texto", () => {
    const secret = "Paciente relata ansiedade. Conduta: encaminhamento."
    const enc = encryptText(secret)
    assert.ok(enc.startsWith("v1:"))
    assert.ok(!enc.includes("ansiedade"))
    assert.equal(decryptText(enc), secret)
  })

  it("usa IV aleatório: o mesmo texto gera cifras diferentes", () => {
    assert.notEqual(encryptText("igual"), encryptText("igual"))
  })

  it("detecta adulteração (GCM)", () => {
    const enc = encryptBuffer(Buffer.from("exame"))
    enc[enc.length - 1] ^= 0xff
    assert.throws(() => decryptBuffer(enc))
  })
})
