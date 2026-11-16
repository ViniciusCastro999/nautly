import { test } from "node:test"
import assert from "node:assert/strict"
import { buildOccurrences, MAX_OCCURRENCES, splitConflicts } from "./recurrence"

test("semanal gera N ocorrências com 7 dias de intervalo", () => {
  const list = buildOccurrences({
    date: "2026-11-17",
    time: "14:00",
    timezone: "America/Sao_Paulo",
    durationMinutes: 50,
    repeat: "weekly",
    count: 4,
  })
  assert.deepEqual(
    list.map((o) => o.startsAt.toISOString()),
    [
      "2026-11-17T17:00:00.000Z",
      "2026-11-24T17:00:00.000Z",
      "2026-12-01T17:00:00.000Z",
      "2026-12-08T17:00:00.000Z",
    ],
  )
  assert.equal(list[0].endsAt.toISOString(), "2026-11-17T17:50:00.000Z")
})

test("quinzenal pula 14 dias", () => {
  const list = buildOccurrences({
    date: "2026-11-17",
    time: "09:30",
    timezone: "America/Sao_Paulo",
    durationMinutes: 30,
    repeat: "biweekly",
    count: 3,
  })
  assert.deepEqual(
    list.map((o) => o.startsAt.toISOString().slice(0, 10)),
    ["2026-11-17", "2026-12-01", "2026-12-15"],
  )
})

test("mantém o horário local na mudança de horário de verão", () => {
  // Nova York muda para o horário de verão em 08/03/2026.
  const list = buildOccurrences({
    date: "2026-03-03",
    time: "10:00",
    timezone: "America/New_York",
    durationMinutes: 60,
    repeat: "weekly",
    count: 2,
  })
  assert.equal(list[0].startsAt.toISOString(), "2026-03-03T15:00:00.000Z") // EST, UTC-5
  assert.equal(list[1].startsAt.toISOString(), "2026-03-10T14:00:00.000Z") // EDT, UTC-4
})

test("sem repetição ignora count e limita séries longas", () => {
  const base = { date: "2026-11-17", time: "08:00", timezone: "UTC", durationMinutes: 30 }
  assert.equal(buildOccurrences({ ...base, repeat: "none", count: 10 }).length, 1)
  assert.equal(buildOccurrences({ ...base, repeat: "weekly", count: 500 }).length, MAX_OCCURRENCES)
})

test("separa ocorrências que colidem com agendamentos existentes", () => {
  const list = buildOccurrences({
    date: "2026-11-17",
    time: "14:00",
    timezone: "UTC",
    durationMinutes: 50,
    repeat: "weekly",
    count: 3,
  })
  const existing = [
    // encosta no fim da primeira: não colide
    { startsAt: new Date("2026-11-17T14:50:00Z"), endsAt: new Date("2026-11-17T15:30:00Z") },
    // sobrepõe a segunda
    { startsAt: new Date("2026-11-24T14:30:00Z"), endsAt: new Date("2026-11-24T15:00:00Z") },
  ]
  const { free, conflicts } = splitConflicts(list, existing)
  assert.equal(free.length, 2)
  assert.deepEqual(
    conflicts.map((c) => c.startsAt.toISOString()),
    ["2026-11-24T14:00:00.000Z"],
  )
})
