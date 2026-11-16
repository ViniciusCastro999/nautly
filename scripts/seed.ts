import "dotenv/config"
import { TZDate } from "@date-fns/tz"
import { eq, or } from "drizzle-orm"
import { db, schema } from "../src/db"
import { auth } from "../src/lib/auth"
import { encryptText } from "../src/lib/crypto"
import type { DocumentPayload } from "../src/lib/documents/pdf"
import { formatInTz } from "../src/lib/format"
import { applyEffect, HEALTHY, type ProcedureEffect, type ToothState } from "../src/lib/dental"
import { buildOccurrences } from "../src/lib/scheduling/recurrence"
import { VERTICALS } from "../src/lib/verticals"
import { storage } from "../src/lib/storage"

const TZ = "America/Sao_Paulo"
const DEMO = {
  email: "demo@nautly.dev",
  password: "demo12345",
  name: "Dra. Ana Souza",
  username: "ana-souza",
}

const PEOPLE = [
  ["Carla Mendes", "carla.mendes@example.com", "(11) 98123-4567", "1991-04-12", "123.456.789-00"],
  ["Rafael Lima", "rafael.lima@example.com", "(21) 99876-1234", "1985-09-30", null],
  ["Juliana Rocha", "juliana.rocha@example.com", null, "1998-01-05", null],
  ["Pedro Alves", "pedro.alves@example.com", "(31) 97777-0000", "1979-11-21", null],
  ["Mariana Costa", "mariana.costa@example.com", "(41) 98888-2222", "2001-06-17", null],
  ["Lucas Ferreira", "lucas.ferreira@example.com", null, null, null],
  ["Beatriz Santos", "beatriz.santos@example.com", "(51) 99999-1111", "1994-03-08", null],
] as const

/** Evoluções de exemplo (nutrição), uma por atendimento passado. */
const NOTES = [
  `Queixa: cansaço à tarde e dificuldade para manter a rotina alimentar.
Objetivo: reduzir 5 kg em 4 meses com melhora de disposição.
Avaliação: peso 72,4 kg, altura 1,65 m (IMC 26,6). Circunferência abdominal 86 cm.
Conduta: plano alimentar com 5 refeições, aumento de fibras e proteína no café da manhã. Solicitado hemograma e perfil lipídico.`,
  `Retorno. Relata boa adesão nos dias úteis e dificuldade aos fins de semana.
Peso 89,1 kg (-1,3 kg). Ajustada a estratégia para refeições fora de casa.`,
  `Avaliação inicial por telefone. Interesse em acompanhamento para ganho de massa magra. Agendada consulta presencial.`,
  `Retorno. Exames dentro da normalidade. Mantido plano atual e incluída suplementação de vitamina D conforme exame.`,
]

/** Próximo dia útil a partir de hoje + offset, às hh:mm em São Paulo. */
function businessDay(offset: number, hour: number, minute = 0) {
  const now = new TZDate(new Date(), TZ)
  const d = new TZDate(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, TZ)
  let added = 0
  const step = offset >= 0 ? 1 : -1
  while (added !== offset) {
    d.setDate(d.getDate() + step)
    if (d.getDay() !== 0 && d.getDay() !== 6) added += step
  }
  return new Date(d.getTime())
}

/** Gera um PDF mínimo válido com algumas linhas de texto (exame fictício). */
function simplePdf(lines: string[]) {
  const text = lines
    .map(
      (l, i) =>
        `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${780 - i * 22} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`,
    )
    .join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text, "latin1")} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"))
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, "latin1")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, "latin1")
}

async function main() {
  // Busca também pelo username, para recriar contas de seeds antigos com outro e-mail.
  const existing = await db.query.user.findFirst({
    where: or(eq(schema.user.email, DEMO.email), eq(schema.user.username, DEMO.username)),
  })
  if (existing) {
    await db.delete(schema.organization).where(eq(schema.organization.slug, DEMO.username))
    await db.delete(schema.user).where(eq(schema.user.id, existing.id))
    console.log("• Usuário demo anterior removido")
  }

  // Cria pelo fluxo real de cadastro (hash de senha + provisionamento do workspace).
  await auth.api.signUpEmail({ body: { ...DEMO, timezone: TZ } })
  const user = (await db.query.user.findFirst({ where: eq(schema.user.email, DEMO.email) }))!
  const member = (await db.query.membership.findFirst({ where: eq(schema.membership.userId, user.id) }))!
  const sched = (await db.query.schedule.findFirst({ where: eq(schema.schedule.userId, user.id) }))!
  const orgId = member.organizationId

  // Onboarding concluído como nutricionista.
  await db
    .update(schema.organization)
    .set({
      vertical: "nutrition",
      modules: ["records", "attachments", "anamnesis", "anthropometry", "documents", "recurring"],
    })
    .where(eq(schema.organization.id, orgId))
  await db
    .update(schema.user)
    .set({
      professionalRegistry: "CRN-3 12345",
      taxId: "123.456.789-09",
      address: "Av. Paulista, 1000, sala 42, São Paulo/SP",
    })
    .where(eq(schema.user.id, user.id))

  const [consulta, retorno, avaliacao] = await db
    .insert(schema.eventType)
    .values([
      {
        organizationId: orgId,
        hostId: user.id,
        scheduleId: sched.id,
        title: "Consulta inicial",
        slug: "consulta-inicial",
        description:
          "Anamnese completa, avaliação corporal e definição de objetivos. Traga seus exames recentes, se tiver.",
        durationMinutes: 50,
        locationType: "in_person",
        locationDetail: "Av. Paulista, 1000, sala 42, São Paulo",
        color: "#1b6a8a",
        bufferAfterMinutes: 10,
        minNoticeMinutes: 720,
        priceCents: 25_000,
      },
      {
        organizationId: orgId,
        hostId: user.id,
        scheduleId: sched.id,
        title: "Retorno",
        slug: "retorno",
        description: "Acompanhamento da evolução e ajustes no plano alimentar.",
        durationMinutes: 30,
        locationType: "video",
        color: "#0ab39c",
        minNoticeMinutes: 240,
        priceCents: 18_000,
      },
      {
        organizationId: orgId,
        hostId: user.id,
        scheduleId: sched.id,
        title: "Avaliação gratuita",
        slug: "avaliacao",
        description: "Conversa rápida por telefone para tirar dúvidas antes de agendar uma consulta.",
        durationMinutes: 15,
        locationType: "phone",
        color: "#8247f5",
        minNoticeMinutes: 60,
      },
    ])
    .returning()

  const contacts = await db
    .insert(schema.contact)
    .values(
      PEOPLE.map(([name, email, phone, birthDate, document]) => ({
        organizationId: orgId,
        name,
        email,
        phone,
        birthDate,
        document,
      })),
    )
    .returning()

  const plan: Array<[typeof consulta, number, number, number, "confirmed" | "cancelled"]> = [
    [consulta, -6, 9, 0, "confirmed"],
    [retorno, -4, 14, 0, "confirmed"],
    [avaliacao, -2, 10, 0, "confirmed"],
    [retorno, -1, 15, 0, "confirmed"],
    [consulta, 1, 9, 0, "confirmed"],
    [retorno, 1, 14, 0, "confirmed"],
    [avaliacao, 2, 11, 0, "confirmed"],
    [retorno, 3, 13, 0, "confirmed"],
    [retorno, 4, 16, 0, "cancelled"],
    [consulta, 6, 10, 0, "confirmed"],
    [retorno, 8, 9, 0, "confirmed"],
  ]

  const bookings = await db
    .insert(schema.booking)
    .values(
      plan.map(([et, offset, h, m, status], i) => {
        const startsAt = businessDay(offset, h, m)
        return {
          organizationId: orgId,
          eventTypeId: et.id,
          hostId: user.id,
          contactId: contacts[i % contacts.length].id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + et.durationMinutes * 60_000),
          status,
          inviteeTimezone: i === 2 ? "Europe/Lisbon" : TZ,
          notes: i % 3 === 0 ? "Gostaria de conversar sobre os resultados dos exames." : null,
          cancelReason: status === "cancelled" ? "Imprevisto no trabalho, vou remarcar." : null,
          attendance: status === "confirmed" && startsAt < new Date() ? ("attended" as const) : null,
        }
      }),
    )
    .returning()

  // Uma falta, para o controle de comparecimento.
  const missedAt = businessDay(-3, 11)
  await db.insert(schema.booking).values({
    organizationId: orgId,
    eventTypeId: retorno.id,
    hostId: user.id,
    contactId: contacts[4].id,
    startsAt: missedAt,
    endsAt: new Date(missedAt.getTime() + retorno.durationMinutes * 60_000),
    inviteeTimezone: TZ,
    attendance: "no_show",
  })

  // Pedro: retornos quinzenais recorrentes a partir do último agendamento dele.
  const pedroNext = bookings[10]
  const [series] = await db
    .insert(schema.bookingSeries)
    .values({
      organizationId: orgId,
      hostId: user.id,
      contactId: pedroNext.contactId,
      eventTypeId: retorno.id,
      frequency: "biweekly",
      timezone: TZ,
    })
    .returning()
  await db.update(schema.booking).set({ seriesId: series.id }).where(eq(schema.booking.id, pedroNext.id))
  const nextOccurrences = buildOccurrences({
    date: formatInTz(pedroNext.startsAt, TZ, "yyyy-MM-dd"),
    time: formatInTz(pedroNext.startsAt, TZ, "HH:mm"),
    timezone: TZ,
    durationMinutes: retorno.durationMinutes,
    repeat: "biweekly",
    count: 4,
  }).slice(1)
  await db.insert(schema.booking).values(
    nextOccurrences.map((o) => ({
      organizationId: orgId,
      eventTypeId: retorno.id,
      hostId: user.id,
      contactId: pedroNext.contactId,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      inviteeTimezone: TZ,
      seriesId: series.id,
    })),
  )

  // Prontuário: uma evolução por atendimento passado + uma anotação privada.
  const pastBookings = bookings.filter((b) => b.startsAt < new Date()).slice(0, NOTES.length)
  await db.insert(schema.clinicalNote).values([
    ...pastBookings.map((b, i) => ({
      organizationId: orgId,
      contactId: b.contactId,
      authorId: user.id,
      bookingId: b.id,
      contentEncrypted: encryptText(NOTES[i]),
      createdAt: b.endsAt,
      updatedAt: b.endsAt,
    })),
    {
      organizationId: orgId,
      contactId: contacts[0].id,
      authorId: user.id,
      isPrivate: true,
      contentEncrypted: encryptText(
        "Comentou ansiedade com o trabalho afetando a alimentação. Avaliar encaminhamento para psicologia se persistir.",
      ),
      createdAt: pastBookings[0].endsAt,
      updatedAt: pastBookings[0].endsAt,
    },
  ])

  // Exame anexado à primeira paciente (arquivo criptografado no storage).
  const pdf = simplePdf([
    "Laboratorio Exemplo - Hemograma completo",
    "Paciente: Carla Mendes",
    "Hemoglobina: 13,2 g/dL (ref. 12,0 a 15,5)",
    "Leucocitos: 6.400 /mm3 (ref. 4.000 a 11.000)",
    "Plaquetas: 245.000 /mm3 (ref. 150.000 a 450.000)",
    "Documento ficticio gerado para demonstracao.",
  ])
  const storageKey = `${orgId}/${crypto.randomUUID()}`
  await storage.put(storageKey, pdf)
  await db.insert(schema.attachment).values({
    organizationId: orgId,
    contactId: contacts[0].id,
    uploadedById: user.id,
    fileName: "hemograma-completo.pdf",
    mimeType: "application/pdf",
    sizeBytes: pdf.length,
    storageKey,
    category: "exam",
    description: "Hemograma solicitado na consulta inicial",
  })

  // Avaliações antropométricas: Pedro com 5 meses de evolução, Carla com a primeira.
  const daysAgo = (n: number) => formatInTz(new Date(Date.now() - n * 86_400_000), TZ, "yyyy-MM-dd")
  const [carla, , , pedro, , lucas] = contacts
  const pedroSeries = [
    [150, 95.2, 104, 106, 28.4, 36.1],
    [120, 93.8, 102, 105, 27.6, 36.3],
    [90, 92.1, 100.5, 104, 26.5, 36.6],
    [60, 91.0, 99, 103.5, 25.8, 36.8],
    [30, 90.4, 98.5, 103, 25.1, 37.0],
    [1, 89.1, 97, 102, 24.3, 37.2],
  ] as const
  await db.insert(schema.measurement).values([
    ...pedroSeries.map(([ago, weightKg, waistCm, hipCm, bodyFatPct, muscleMassKg], i) => ({
      organizationId: orgId,
      contactId: pedro.id,
      authorId: user.id,
      measuredOn: daysAgo(ago),
      weightKg,
      heightCm: i === 0 ? 178 : null,
      waistCm,
      hipCm,
      bodyFatPct,
      muscleMassKg,
    })),
    {
      organizationId: orgId,
      contactId: carla.id,
      authorId: user.id,
      measuredOn: formatInTz(bookings[0].startsAt, TZ, "yyyy-MM-dd"),
      weightKg: 72.4,
      heightCm: 165,
      waistCm: 86,
      hipCm: 104,
      bodyFatPct: 31.2,
      muscleMassKg: 23.5,
    },
  ])

  // Anamneses: Carla e Pedro já responderam pelo link; Lucas (paciente novo) ainda não.
  await db.insert(schema.anamnesis).values([
    {
      organizationId: orgId,
      contactId: carla.id,
      templateId: "nutrition",
      status: "completed",
      filledBy: "patient",
      completedAt: new Date(bookings[0].startsAt.getTime() - 2 * 86_400_000),
      createdAt: new Date(bookings[0].startsAt.getTime() - 3 * 86_400_000),
      answersEncrypted: encryptText(
        JSON.stringify({
          goal: "Emagrecimento",
          reason: "Quero perder uns 5 kg e ter mais disposição à tarde. Belisco muito no trabalho.",
          conditions: "Não",
          medications: "Sim",
          medications_detail: "Anticoncepcional",
          allergies: "Não",
          meals_per_day: "3",
          water: "1",
          restrictions: ["Sem lactose"],
          activity: "1 a 2x por semana",
          bowel: "Preso",
          dislikes: "Fígado e jiló",
        }),
      ),
    },
    {
      organizationId: orgId,
      contactId: pedro.id,
      templateId: "nutrition",
      status: "completed",
      filledBy: "professional",
      completedAt: new Date(Date.now() - 150 * 86_400_000),
      createdAt: new Date(Date.now() - 150 * 86_400_000),
      answersEncrypted: encryptText(
        JSON.stringify({
          goal: "Saúde e exames",
          reason: "Colesterol alto no último check-up. Médico recomendou acompanhamento.",
          conditions: "Sim",
          conditions_detail: "Hipercolesterolemia",
          medications: "Sim",
          medications_detail: "Sinvastatina 20 mg",
          allergies: "Não",
          meals_per_day: "4",
          water: "1.5",
          restrictions: ["Nenhuma"],
          activity: "Sedentário",
          bowel: "Regular",
        }),
      ),
    },
    { organizationId: orgId, contactId: lucas.id, templateId: "nutrition" },
  ])

  // Recibo já emitido para a consulta inicial da Carla.
  const receipt: DocumentPayload = {
    kind: "receipt",
    professional: {
      name: DEMO.name,
      registry: "CRN-3 12345",
      taxId: "123.456.789-09",
      address: "Av. Paulista, 1000, sala 42, São Paulo/SP",
    },
    patient: { name: carla.name, document: carla.document },
    items: [{ date: formatInTz(bookings[0].startsAt, TZ, "dd/MM/yyyy"), description: consulta.title }],
    totalCents: 25_000,
    paymentMethod: "Pix",
    issuedOn: formatInTz(bookings[0].endsAt, TZ, "d 'de' MMMM 'de' yyyy"),
    issuedAtLabel: formatInTz(bookings[0].endsAt, TZ, "dd/MM/yyyy 'às' HH:mm"),
  }
  await db.insert(schema.issuedDocument).values({
    organizationId: orgId,
    contactId: carla.id,
    issuedById: user.id,
    kind: "receipt",
    number: 1,
    payload: receipt,
    createdAt: bookings[0].endsAt,
  })

  // Um feriado de exemplo daqui a ~2 semanas.
  const holiday = businessDay(10, 12)
  await db.insert(schema.dateOverride).values({
    scheduleId: sched.id,
    date: new TZDate(holiday, TZ).toISOString().slice(0, 10),
    startMinute: null,
    endMinute: null,
  })

  console.log(`✓ Seed concluído: ${DEMO.email} / ${DEMO.password}  →  /${DEMO.username}`)

  await seedDentist()
  process.exit(0)
}

/* -------------------------------------------------------------------------- */
/*                      Segunda conta demo: consultório odontológico           */
/* -------------------------------------------------------------------------- */

const DENTIST = {
  email: "demo-dentista@nautly.dev",
  password: "demo12345",
  name: "Dr. Marcos Tavares",
  username: "marcos-tavares",
}

async function seedDentist() {
  // Busca também pelo username, para recriar contas de seeds antigos com outro e-mail.
  const existing = await db.query.user.findFirst({
    where: or(eq(schema.user.email, DENTIST.email), eq(schema.user.username, DENTIST.username)),
  })
  if (existing) {
    await db.delete(schema.organization).where(eq(schema.organization.slug, DENTIST.username))
    await db.delete(schema.user).where(eq(schema.user.id, existing.id))
  }
  await auth.api.signUpEmail({ body: { ...DENTIST, timezone: TZ } })
  const user = (await db.query.user.findFirst({ where: eq(schema.user.email, DENTIST.email) }))!
  const member = (await db.query.membership.findFirst({ where: eq(schema.membership.userId, user.id) }))!
  const sched = (await db.query.schedule.findFirst({ where: eq(schema.schedule.userId, user.id) }))!
  const orgId = member.organizationId
  const vertical = VERTICALS.dentistry
  const professional = {
    name: DENTIST.name,
    registry: "CRO-SP 98765",
    taxId: "12.345.678/0001-90",
    address: "Rua Augusta, 500, conj. 12, São Paulo/SP",
  }

  await db
    .update(schema.organization)
    .set({ vertical: "dentistry", modules: [...vertical.defaultModules, "recurring"] })
    .where(eq(schema.organization.id, orgId))
  await db
    .update(schema.user)
    .set({
      professionalRegistry: professional.registry,
      taxId: professional.taxId,
      address: professional.address,
    })
    .where(eq(schema.user.id, user.id))

  const [avaliacao, limpeza] = await db
    .insert(schema.eventType)
    .values(
      vertical.eventPresets.map((preset, i) => ({
        ...preset,
        organizationId: orgId,
        hostId: user.id,
        scheduleId: sched.id,
        locationDetail: "Rua Augusta, 500, conj. 12, São Paulo",
        priceCents: i === 0 ? 15_000 : 25_000,
      })),
    )
    .returning()

  const procedures = await db
    .insert(schema.procedure)
    .values(
      (vertical.procedurePresets ?? []).map((p) => ({
        organizationId: orgId,
        name: p.name,
        priceCents: p.priceCents,
        effect: p.effect ?? null,
        perTooth: Boolean(p.perTooth),
      })),
    )
    .returning()
  const proc = (name: string) => procedures.find((p) => p.name.startsWith(name))!

  const [pedro, fernanda, gustavo, helena] = await db
    .insert(schema.contact)
    .values([
      {
        organizationId: orgId,
        name: "Pedro Lima",
        email: "pedro.lima@example.com",
        phone: "(11) 97654-3210",
        birthDate: "1983-02-14",
        document: "987.654.321-00",
      },
      {
        organizationId: orgId,
        name: "Fernanda Dias",
        email: "fernanda.dias@example.com",
        phone: "(11) 98765-1122",
        birthDate: "1996-08-03",
      },
      {
        organizationId: orgId,
        name: "Gustavo Rocha",
        email: "gustavo.rocha@example.com",
        phone: "(11) 91234-8899",
        birthDate: "1990-12-01",
      },
      {
        organizationId: orgId,
        name: "Helena Martins",
        email: "familia.martins@example.com",
        phone: "(11) 99887-6655",
        birthDate: "2019-05-20",
        notes: "Responsável: Paula Martins (mãe).",
      },
    ])
    .returning()

  const visit = (contactId: string, et: typeof avaliacao, offset: number, hour: number) => {
    const startsAt = businessDay(offset, hour)
    return {
      organizationId: orgId,
      eventTypeId: et.id,
      hostId: user.id,
      contactId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + et.durationMinutes * 60_000),
      inviteeTimezone: TZ,
      attendance: offset < 0 ? ("attended" as const) : null,
    }
  }
  const visits = await db
    .insert(schema.booking)
    .values([
      visit(pedro.id, avaliacao, -15, 9),
      visit(pedro.id, limpeza, -8, 10),
      visit(pedro.id, avaliacao, -3, 14),
      visit(gustavo.id, avaliacao, -2, 11),
      visit(helena.id, avaliacao, -1, 16),
      visit(fernanda.id, avaliacao, -1, 9),
      visit(pedro.id, avaliacao, 2, 9),
      visit(fernanda.id, limpeza, 4, 15),
      visit(gustavo.id, limpeza, 6, 10),
    ])
    .returning()

  // Odontograma inicial (antes do tratamento).
  const teeth: Record<string, Record<number, ToothState>> = {
    [pedro.id]: {
      18: { status: "missing", surfaces: {} },
      28: { status: "missing", surfaces: {} },
      38: { status: "missing", surfaces: {} },
      48: { status: "missing", surfaces: {} },
      16: { status: "healthy", surfaces: { M: "caries", O: "caries" } },
      26: { status: "healthy", surfaces: { O: "restored" } },
      36: { status: "healthy", surfaces: { M: "caries", O: "caries", D: "caries" } },
      46: { status: "extraction", surfaces: { O: "caries" } },
      11: { status: "crown", surfaces: {} },
    },
    [fernanda.id]: {
      14: { status: "healthy", surfaces: { O: "caries" } },
      24: { status: "healthy", surfaces: { O: "sealant" } },
      37: { status: "healthy", surfaces: { O: "restored", V: "restored" } },
    },
    [helena.id]: {
      54: { status: "healthy", surfaces: { O: "caries" } },
      64: { status: "healthy", surfaces: { O: "sealant" } },
      74: { status: "healthy", surfaces: { O: "sealant" } },
      85: { status: "healthy", surfaces: { D: "caries", O: "caries" } },
    },
  }

  // Plano do Pedro aprovado pelo link, com parte já executada.
  const approvedAt = new Date(visits[0].endsAt.getTime() + 26 * 3_600_000)
  const [pedroPlan] = await db
    .insert(schema.treatmentPlan)
    .values({
      organizationId: orgId,
      contactId: pedro.id,
      createdById: user.id,
      title: "Tratamento restaurador e reabilitação",
      status: "approved",
      discountCents: 20_000,
      notes: "Pagamento em até 6x sem juros no cartão. Implante após 90 dias da extração.",
      approvedAt,
      approvedByName: "Pedro Henrique Lima",
      approvedIp: "177.12.34.56",
      createdAt: visits[0].endsAt,
    })
    .returning()
  const pedroItems: Array<[string, number | null, string | null, boolean, Date | null]> = [
    ["Profilaxia", null, null, true, visits[1].endsAt],
    ["Tratamento de canal", 36, null, true, visits[2].endsAt],
    ["Restauração", 36, "MOD", true, visits[2].endsAt],
    ["Restauração", 16, "MO", false, null],
    ["Extração", 46, null, false, null],
    ["Implante", 46, null, false, null],
  ]
  await db.insert(schema.treatmentItem).values(
    pedroItems.map(([name, tooth, surfaces, done, doneAt], position) => {
      const p = proc(name)
      return {
        planId: pedroPlan.id,
        procedureId: p.id,
        description: p.name,
        tooth,
        surfaces,
        priceCents: p.priceCents,
        position,
        doneAt: done ? doneAt : null,
        doneById: done ? user.id : null,
      }
    }),
  )
  // Procedimentos concluídos já aparecem no odontograma.
  for (const [name, tooth, surfaces, done] of pedroItems) {
    const effect = proc(name).effect as ProcedureEffect | null
    if (!done || tooth === null || !effect) continue
    const current = teeth[pedro.id][tooth] ?? HEALTHY
    teeth[pedro.id][tooth] = applyEffect(current, effect, (surfaces?.split("") ?? []) as ("O" | "M" | "D")[])
  }

  // Plano da Fernanda aguardando aprovação pelo link.
  const [fernandaPlan] = await db
    .insert(schema.treatmentPlan)
    .values({
      organizationId: orgId,
      contactId: fernanda.id,
      createdById: user.id,
      title: "Restauração e clareamento",
      status: "presented",
      validUntil: formatInTz(new Date(Date.now() + 30 * 86_400_000), TZ, "yyyy-MM-dd"),
      notes: "Clareamento após a restauração.",
      createdAt: visits[5].endsAt,
    })
    .returning()
  await db.insert(schema.treatmentItem).values([
    {
      planId: fernandaPlan.id,
      procedureId: proc("Restauração").id,
      description: proc("Restauração").name,
      tooth: 14,
      surfaces: "O",
      priceCents: proc("Restauração").priceCents,
      position: 0,
    },
    {
      planId: fernandaPlan.id,
      procedureId: proc("Clareamento").id,
      description: proc("Clareamento").name,
      priceCents: proc("Clareamento").priceCents,
      position: 1,
    },
  ])

  await db.insert(schema.toothRecord).values(
    Object.entries(teeth).flatMap(([contactId, chart]) =>
      Object.entries(chart).map(([tooth, state]) => ({
        organizationId: orgId,
        contactId,
        tooth: Number(tooth),
        status: state.status,
        surfaces: state.surfaces as Record<string, string>,
        updatedById: user.id,
      })),
    ),
  )
  await db.insert(schema.toothRecord).values({
    organizationId: orgId,
    contactId: pedro.id,
    tooth: 21,
    notes: "Sensibilidade ao frio relatada na avaliação.",
    updatedById: user.id,
  })

  await db.insert(schema.clinicalNote).values([
    {
      organizationId: orgId,
      contactId: pedro.id,
      authorId: user.id,
      bookingId: visits[2].id,
      contentEncrypted: encryptText(
        "Tratamento endodôntico do 36 concluído em sessão única, seguido de restauração MOD em resina. Paciente sem dor. Prescrito analgésico se necessário.",
      ),
      createdAt: visits[2].endsAt,
      updatedAt: visits[2].endsAt,
    },
  ])

  await db.insert(schema.anamnesis).values([
    {
      organizationId: orgId,
      contactId: pedro.id,
      templateId: "dentistry",
      status: "completed",
      filledBy: "patient",
      completedAt: new Date(visits[0].startsAt.getTime() - 86_400_000),
      createdAt: new Date(visits[0].startsAt.getTime() - 2 * 86_400_000),
      answersEncrypted: encryptText(
        JSON.stringify({
          reason: "Dor ao mastigar do lado esquerdo e um dente quebrado embaixo do lado direito.",
          conditions: "Não",
          medications: "Não",
          allergies: "Sim",
          allergies_detail: "Dipirona",
          bleeding: "Sim",
          sensitivity: "Sim",
          anesthesia: "Não",
          pregnant: "Não",
          last_visit: "Há uns 3 anos",
        }),
      ),
    },
    { organizationId: orgId, contactId: gustavo.id, templateId: "dentistry" },
  ])

  // Documentos: recibo da limpeza, atestado do Gustavo e receita após o canal.
  const at = (d: Date) => ({
    issuedOn: formatInTz(d, TZ, "d 'de' MMMM 'de' yyyy"),
    issuedAtLabel: formatInTz(d, TZ, "dd/MM/yyyy 'às' HH:mm"),
  })
  const docs: Array<{ contactId: string; createdAt: Date; payload: DocumentPayload }> = [
    {
      contactId: pedro.id,
      createdAt: visits[1].endsAt,
      payload: {
        kind: "receipt",
        professional,
        patient: { name: pedro.name, document: pedro.document },
        items: [{ date: formatInTz(visits[1].startsAt, TZ, "dd/MM/yyyy"), description: limpeza.title }],
        totalCents: 25_000,
        paymentMethod: "Cartão de crédito",
        ...at(visits[1].endsAt),
      },
    },
    {
      contactId: pedro.id,
      createdAt: visits[2].endsAt,
      payload: {
        kind: "prescription",
        professional,
        patient: { name: pedro.name, document: pedro.document },
        usage: "Uso oral",
        items: [
          {
            name: "Ibuprofeno 600 mg, 10 comprimidos",
            instructions: "Tomar 1 comprimido de 8 em 8 horas, se houver dor, por até 3 dias.",
          },
          {
            name: "Paracetamol 750 mg, 10 comprimidos",
            instructions: "Alternativa em caso de dor persistente: 1 comprimido de 6 em 6 horas.",
          },
        ],
        notes: "Paciente alérgico a dipirona. Evitar mastigar do lado tratado nas primeiras 24 horas.",
        ...at(visits[2].endsAt),
      },
    },
    {
      contactId: gustavo.id,
      createdAt: visits[3].endsAt,
      payload: {
        kind: "certificate",
        professional,
        patient: { name: gustavo.name, document: null },
        date: formatInTz(visits[3].startsAt, TZ, "dd/MM/yyyy"),
        start: formatInTz(visits[3].startsAt, TZ, "HH:mm"),
        end: formatInTz(visits[3].endsAt, TZ, "HH:mm"),
        days: 0,
        cid: null,
        ...at(visits[3].endsAt),
      },
    },
  ]
  await db.insert(schema.issuedDocument).values(
    docs.map((d, i) => ({
      organizationId: orgId,
      contactId: d.contactId,
      issuedById: user.id,
      kind: d.payload.kind,
      number: i + 1,
      payload: d.payload,
      createdAt: d.createdAt,
    })),
  )

  console.log(`✓ Dentista demo: ${DENTIST.email} / ${DENTIST.password}  →  /${DENTIST.username}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
