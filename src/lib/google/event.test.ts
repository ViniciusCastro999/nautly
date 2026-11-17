import assert from "node:assert/strict"
import { test } from "node:test"
import { buildGoogleEvent, mergeBusy } from "./event"

const base = {
  id: "bk_1",
  startsAt: new Date("2026-11-20T12:00:00Z"),
  endsAt: new Date("2026-11-20T12:50:00Z"),
  service: "Consulta inicial",
  locationType: "video" as const,
  locationDetail: "https://meet.example.com/abc",
  contact: { name: "Carla Mendes", email: "carla@example.com", phone: null },
  recordUrl: "https://nautly.vercel.app/app/contacts/c1",
}

test("evento leva serviço, nome e horário em UTC", () => {
  const ev = buildGoogleEvent(base)
  assert.equal(ev.summary, "Consulta inicial · Carla Mendes")
  assert.equal(ev.start.dateTime, "2026-11-20T12:00:00.000Z")
  assert.equal(ev.end.dateTime, "2026-11-20T12:50:00.000Z")
  assert.equal(ev.location, "Videochamada: https://meet.example.com/abc")
  assert.equal(ev.extendedProperties.private.nautlyBookingId, "bk_1")
})

test("descrição omite contato ausente e aponta para a ficha", () => {
  const ev = buildGoogleEvent(base)
  assert.ok(!ev.description.includes("Telefone"))
  assert.ok(ev.description.includes("E-mail: carla@example.com"))
  assert.ok(ev.description.endsWith("Ficha no Nautly: https://nautly.vercel.app/app/contacts/c1"))
})

test("presencial usa o endereço como local", () => {
  const ev = buildGoogleEvent({ ...base, locationType: "in_person", locationDetail: "Rua A, 10" })
  assert.equal(ev.location, "Rua A, 10")
  const semEndereco = buildGoogleEvent({ ...base, locationType: "in_person", locationDetail: null })
  assert.equal(semEndereco.location, "Presencial")
})

test("mergeBusy junta intervalos sobrepostos e encostados", () => {
  const d = (h: number) => new Date(Date.UTC(2026, 10, 20, h))
  const merged = mergeBusy([
    { start: d(14), end: d(15) },
    { start: d(9), end: d(10) },
    { start: d(10), end: d(11) },
    { start: d(14), end: d(14) },
  ])
  assert.deepEqual(merged, [
    { start: d(9), end: d(11) },
    { start: d(14), end: d(15) },
  ])
})
