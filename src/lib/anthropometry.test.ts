import { test } from "node:test"
import assert from "node:assert/strict"
import { bmi, bmiCategory, delta, metricValue, waistHipRatio } from "./anthropometry"

test("IMC com uma casa decimal", () => {
  assert.equal(bmi(72.4, 165), 26.6)
  assert.equal(bmi(null, 165), null)
  assert.equal(bmi(70, null), null)
})

test("classificação do IMC nos limites da OMS", () => {
  assert.equal(bmiCategory(18.4)?.label, "Abaixo do peso")
  assert.equal(bmiCategory(18.5)?.label, "Peso adequado")
  assert.equal(bmiCategory(24.9)?.label, "Peso adequado")
  assert.equal(bmiCategory(25)?.label, "Sobrepeso")
  assert.equal(bmiCategory(30)?.label, "Obesidade grau I")
  assert.equal(bmiCategory(40)?.label, "Obesidade grau III")
  assert.equal(bmiCategory(null), null)
})

test("relação cintura/quadril", () => {
  assert.equal(waistHipRatio(86, 104), 0.83)
  assert.equal(waistHipRatio(86, null), null)
})

test("IMC usa a última altura conhecida quando a avaliação não tem altura", () => {
  const m = { weightKg: 70, heightCm: null, waistCm: null, hipCm: null, bodyFatPct: null, muscleMassKg: null }
  assert.equal(metricValue(m, "bmi"), null)
  assert.equal(metricValue(m, "bmi", 165), 25.7)
})

test("delta evita ruído de ponto flutuante", () => {
  assert.equal(delta("weightKg", 70.3, 72.4), -2.1)
  assert.equal(delta("weightKg", 70, null), null)
})
