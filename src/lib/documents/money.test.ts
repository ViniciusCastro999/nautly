import { test } from "node:test"
import assert from "node:assert/strict"
import { amountInWords, numberInWords, parseBRL } from "./money"

test("números por extenso", () => {
  const cases: [number, string][] = [
    [0, "zero"],
    [1, "um"],
    [16, "dezesseis"],
    [21, "vinte e um"],
    [100, "cem"],
    [101, "cento e um"],
    [250, "duzentos e cinquenta"],
    [999, "novecentos e noventa e nove"],
    [1000, "mil"],
    [1050, "mil e cinquenta"],
    [1200, "mil e duzentos"],
    [1250, "mil duzentos e cinquenta"],
    [2001, "dois mil e um"],
    [100_000, "cem mil"],
    [345_678, "trezentos e quarenta e cinco mil seiscentos e setenta e oito"],
  ]
  for (const [n, words] of cases) assert.equal(numberInWords(n), words, String(n))
})

test("valores em reais por extenso", () => {
  assert.equal(amountInWords(40_000), "quatrocentos reais")
  assert.equal(amountInWords(100), "um real")
  assert.equal(amountInWords(150), "um real e cinquenta centavos")
  assert.equal(amountInWords(1), "um centavo")
  assert.equal(amountInWords(125_090), "mil duzentos e cinquenta reais e noventa centavos")
})

test("parse de valores digitados", () => {
  assert.equal(parseBRL("400"), 40_000)
  assert.equal(parseBRL("400,5"), 40_050)
  assert.equal(parseBRL("R$ 1.250,90"), 125_090)
  assert.equal(parseBRL("1250,90"), 125_090)
  assert.equal(parseBRL("abc"), null)
  assert.equal(parseBRL("12,345"), null)
})
