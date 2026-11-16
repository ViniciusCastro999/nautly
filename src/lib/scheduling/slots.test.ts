import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { computeSlots, isSlotAvailable, type SlotInput } from "./slots"

// Segunda-feira, 16/11/2026, 00:00 em São Paulo (UTC-3) = 03:00Z
const MONDAY = new Date("2026-11-16T03:00:00Z")

const base: SlotInput = {
  timezone: "America/Sao_Paulo",
  rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
  overrides: [],
  busy: [],
  durationMinutes: 60,
  from: MONDAY,
  to: new Date("2026-11-17T03:00:00Z"),
  now: new Date("2026-11-15T12:00:00Z"),
}

const iso = (ds: Date[]) => ds.map((d) => d.toISOString())

describe("computeSlots", () => {
  it("gera horários no fuso do profissional", () => {
    assert.deepEqual(iso(computeSlots(base)), [
      "2026-11-16T12:00:00.000Z",
      "2026-11-16T13:00:00.000Z",
      "2026-11-16T14:00:00.000Z",
    ])
  })

  it("não gera slot que ultrapassa o fim da janela", () => {
    const slots = computeSlots({ ...base, durationMinutes: 50 })
    assert.equal(slots.length, 3) // 9:00, 9:50, 10:40 (11:30 + 50 > 12:00)
  })

  it("remove horários que conflitam com agendamentos e buffers", () => {
    const slots = computeSlots({
      ...base,
      busy: [{ start: new Date("2026-11-16T13:00:00Z"), end: new Date("2026-11-16T14:00:00Z") }],
      bufferAfterMinutes: 15,
    })
    // 9:00 termina 10:00 + 15 min de buffer => conflita com 10:00
    assert.deepEqual(iso(slots), ["2026-11-16T14:00:00.000Z"])
  })

  it("respeita a antecedência mínima", () => {
    const slots = computeSlots({
      ...base,
      now: new Date("2026-11-16T11:30:00Z"), // 08:30 local
      minNoticeMinutes: 120, // só a partir de 10:30
    })
    assert.deepEqual(iso(slots), ["2026-11-16T14:00:00.000Z"])
  })

  it("aplica bloqueio de dia inteiro", () => {
    const slots = computeSlots({
      ...base,
      overrides: [{ date: "2026-11-16", startMinute: null, endMinute: null }],
    })
    assert.equal(slots.length, 0)
  })

  it("aplica horário especial no lugar da regra semanal", () => {
    const slots = computeSlots({
      ...base,
      overrides: [{ date: "2026-11-16", startMinute: 14 * 60, endMinute: 15 * 60 }],
    })
    assert.deepEqual(iso(slots), ["2026-11-16T17:00:00.000Z"])
  })

  it("trata horário de verão (America/New_York, 08/03/2026)", () => {
    const slots = computeSlots({
      ...base,
      timezone: "America/New_York",
      rules: [{ weekday: 0, startMinute: 9 * 60, endMinute: 10 * 60 }],
      from: new Date("2026-03-07T00:00:00Z"),
      to: new Date("2026-03-10T00:00:00Z"),
      now: new Date("2026-03-01T00:00:00Z"),
    })
    // Após a mudança, NY é UTC-4: 09:00 local = 13:00Z
    assert.deepEqual(iso(slots), ["2026-03-08T13:00:00.000Z"])
  })

  it("isSlotAvailable valida um início exato", () => {
    const rest = { ...base, from: undefined, to: undefined }
    assert.equal(isSlotAvailable(rest, new Date("2026-11-16T12:00:00Z")), true)
    assert.equal(isSlotAvailable(rest, new Date("2026-11-16T12:30:00Z")), false)
  })
})
