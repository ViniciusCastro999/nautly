import { relations, sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/* -------------------------------------------------------------------------- */
/*                             Auth (Better Auth)                             */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  /** Registro profissional, ex.: "CRP 06/123456". */
  professionalRegistry: text("professional_registry"),
  /** CPF ou CNPJ, impresso nos recibos. */
  taxId: text("tax_id"),
  /** Endereço do consultório, impresso nos documentos. */
  address: text("address"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/* -------------------------------------------------------------------------- */
/*                                Multi-tenant                                */
/* -------------------------------------------------------------------------- */

/**
 * Uma organização é o "tenant". Hoje todo usuário ganha uma organização
 * pessoal ao se cadastrar; no futuro, um consultório/clínica é uma
 * organização `clinic` com vários profissionais (membros).
 */
export const orgKind = pgEnum("org_kind", ["personal", "clinic"])
export const memberRole = pgEnum("member_role", ["owner", "admin", "professional", "receptionist"])

export const organization = pgTable("organization", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: orgKind("kind").notNull().default("personal"),
  /** Área de atuação (ver src/lib/verticals.ts). Nulo = onboarding pendente. */
  vertical: text("vertical"),
  /** Módulos ativos (ver src/lib/modules.ts). */
  modules: text("modules")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: createdAt(),
})

export const membership = pgTable(
  "membership",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("professional"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("membership_org_user_uq").on(t.organizationId, t.userId)],
)

/* -------------------------------------------------------------------------- */
/*                                Disponibilidade                             */
/* -------------------------------------------------------------------------- */

/** Um conjunto de horários semanais de um profissional, em um fuso horário. */
export const schedule = pgTable(
  "schedule",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("schedule_user_idx").on(t.userId)],
)

/** Janela recorrente: ex. segunda (1), 09:00 (540) até 12:00 (720). */
export const availabilityRule = pgTable(
  "availability_rule",
  {
    id: id(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schedule.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = domingo
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
  },
  (t) => [index("availability_rule_schedule_idx").on(t.scheduleId)],
)

/** Exceção para uma data: bloqueio do dia todo (start/end nulos) ou horário especial. */
export const dateOverride = pgTable(
  "date_override",
  {
    id: id(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schedule.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    startMinute: smallint("start_minute"),
    endMinute: smallint("end_minute"),
  },
  (t) => [index("date_override_schedule_idx").on(t.scheduleId, t.date)],
)

/* -------------------------------------------------------------------------- */
/*                              Tipos de evento                               */
/* -------------------------------------------------------------------------- */

export const locationType = pgEnum("location_type", ["video", "phone", "in_person"])

/** Um "serviço" agendável: Consulta inicial (50 min), Retorno (30 min)... */
export const eventType = pgTable(
  "event_type",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scheduleId: text("schedule_id").references(() => schedule.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    locationType: locationType("location_type").notNull().default("video"),
    locationDetail: text("location_detail"),
    color: text("color").notNull().default("#8247f5"),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    minNoticeMinutes: integer("min_notice_minutes").notNull().default(240),
    maxDaysAhead: integer("max_days_ahead").notNull().default(60),
    /** Valor de referência em centavos (sugerido nos recibos). Não é cobrança. */
    priceCents: integer("price_cents"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("event_type_host_slug_uq").on(t.hostId, t.slug),
    index("event_type_org_idx").on(t.organizationId),
  ],
)

/* -------------------------------------------------------------------------- */
/*                        Contatos (futuros pacientes)                        */
/* -------------------------------------------------------------------------- */

export const contact = pgTable(
  "contact",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    birthDate: date("birth_date", { mode: "string" }),
    /** CPF ou outro documento. */
    document: text("document"),
    /** Observações administrativas (não clínicas), visíveis à recepção. */
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("contact_org_email_uq").on(t.organizationId, t.email)],
)

/* -------------------------------------------------------------------------- */
/*                                Agendamentos                                */
/* -------------------------------------------------------------------------- */

export const bookingStatus = pgEnum("booking_status", ["confirmed", "cancelled"])
export const attendance = pgEnum("attendance", ["attended", "no_show"])
export const recurrenceFrequency = pgEnum("recurrence_frequency", ["weekly", "biweekly"])

/** Série de agendamentos recorrentes (horário fixo semanal ou quinzenal). */
export const bookingSeries = pgTable("booking_series", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  hostId: text("host_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  contactId: text("contact_id")
    .notNull()
    .references(() => contact.id, { onDelete: "cascade" }),
  eventTypeId: text("event_type_id")
    .notNull()
    .references(() => eventType.id, { onDelete: "cascade" }),
  frequency: recurrenceFrequency("frequency").notNull(),
  timezone: text("timezone").notNull(),
  createdAt: createdAt(),
})

export const booking = pgTable(
  "booking",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventTypeId: text("event_type_id")
      .notNull()
      .references(() => eventType.id, { onDelete: "cascade" }),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("confirmed"),
    inviteeTimezone: text("invitee_timezone").notNull(),
    notes: text("notes"),
    cancelReason: text("cancel_reason"),
    /** Comparecimento, marcado pelo profissional após o horário. */
    attendance: attendance("attendance"),
    seriesId: text("series_id").references(() => bookingSeries.id, { onDelete: "set null" }),
    /** Evento correspondente no Google Calendar do profissional, quando sincronizado. */
    googleEventId: text("google_event_id"),
    /** Token secreto para o convidado gerenciar (cancelar) sem login. */
    manageToken: text("manage_token")
      .notNull()
      .$defaultFn(() => crypto.randomUUID().replaceAll("-", "")),
    createdAt: createdAt(),
  },
  (t) => [
    index("booking_host_time_idx").on(t.hostId, t.startsAt),
    index("booking_org_time_idx").on(t.organizationId, t.startsAt),
    index("booking_series_idx").on(t.seriesId),
  ],
)

/* -------------------------------------------------------------------------- */
/*                         Integração com Google Calendar                      */
/* -------------------------------------------------------------------------- */

/**
 * Conta Google conectada por um profissional (uma por usuário). Os tokens
 * ficam criptografados (AES-256-GCM), como o prontuário.
 */
export const calendarConnection = pgTable("calendar_connection", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("google"),
  /** E-mail da conta Google, para mostrar na tela. */
  accountEmail: text("account_email").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  calendarId: text("calendar_id").notNull().default("primary"),
  /** Cria, atualiza e remove eventos no Google a cada agendamento. */
  pushBookings: boolean("push_bookings").notNull().default(true),
  /** Compromissos do Google bloqueiam horários na página pública. */
  blockBusy: boolean("block_busy").notNull().default(true),
  /** Último erro de sincronização, para avisar na tela. */
  lastError: text("last_error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/* -------------------------------------------------------------------------- */
/*                         Prontuário, anexos, auditoria                       */
/* -------------------------------------------------------------------------- */

/**
 * Registro de evolução (prontuário). O conteúdo é criptografado na aplicação
 * (AES-256-GCM) antes de ir para o banco. Registros clínicos não são apagados,
 * apenas editados pelo autor, com data de edição.
 */
export const clinicalNote = pgTable(
  "clinical_note",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    bookingId: text("booking_id").references(() => booking.id, { onDelete: "set null" }),
    /** Texto criptografado ("v1:<base64>"). */
    contentEncrypted: text("content_encrypted").notNull(),
    /** Anotação privada: só o autor vê. */
    isPrivate: boolean("is_private").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("clinical_note_contact_idx").on(t.contactId, t.createdAt)],
)

export const attachmentCategory = pgEnum("attachment_category", ["exam", "image", "document", "other"])

/** Arquivo anexado à ficha. O conteúdo fica criptografado no storage. */
export const attachment = pgTable(
  "attachment",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    category: attachmentCategory("category").notNull().default("other"),
    description: text("description"),
    /** Exames: quando o profissional conferiu o laudo. Nulo = para revisar. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedById: text("reviewed_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("attachment_contact_idx").on(t.contactId, t.createdAt)],
)

/* -------------------------------------------------------------------------- */
/*                                 Financeiro                                 */
/* -------------------------------------------------------------------------- */

export const paymentMethod = pgEnum("payment_method", ["pix", "card", "cash", "transfer", "other"])

/**
 * Pagamento recebido. Pode estar ligado a um atendimento (um pagamento por
 * atendimento) ou ser avulso. Atendimentos com valor e sem pagamento ficam
 * "a receber" ou "em atraso" no Financeiro.
 */
export const payment = pgTable(
  "payment",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").references(() => booking.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethod("method").notNull().default("pix"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    description: text("description"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payment_booking_uq").on(t.bookingId),
    index("payment_org_paid_idx").on(t.organizationId, t.paidAt),
    index("payment_contact_idx").on(t.contactId),
  ],
)

export const accessAction = pgEnum("access_action", [
  "record_viewed",
  "note_created",
  "note_updated",
  "attachment_uploaded",
  "attachment_downloaded",
  "anamnesis_viewed",
  "anamnesis_filled",
  "measurement_created",
  "document_issued",
  "odontogram_updated",
  "treatment_plan_updated",
  "treatment_plan_approved",
])

/** Trilha de auditoria (LGPD): quem acessou qual dado sensível e quando. */
export const accessLog = pgTable(
  "access_log",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Nulo quando quem agiu foi o próprio paciente (ex.: anamnese pelo link). */
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contact.id, { onDelete: "cascade" }),
    action: accessAction("action").notNull(),
    targetId: text("target_id"),
    createdAt: createdAt(),
  },
  (t) => [index("access_log_contact_idx").on(t.contactId, t.createdAt)],
)

/* -------------------------------------------------------------------------- */
/*                     Anamnese, avaliações e documentos                       */
/* -------------------------------------------------------------------------- */

export const anamnesisStatus = pgEnum("anamnesis_status", ["pending", "completed"])

/**
 * Anamnese baseada em um modelo de src/lib/anamnesis. Pode ser preenchida pelo
 * paciente via link público (token) ou pelo profissional. Respostas criptografadas.
 */
export const anamnesis = pgTable(
  "anamnesis",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    status: anamnesisStatus("status").notNull().default("pending"),
    /** Link público de preenchimento; deixa de valer quando concluída. */
    token: text("token")
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID().replaceAll("-", "")),
    /** JSON das respostas, criptografado ("v1:<base64>"). */
    answersEncrypted: text("answers_encrypted"),
    filledBy: text("filled_by", { enum: ["patient", "professional"] }),
    requestedById: text("requested_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("anamnesis_contact_idx").on(t.contactId, t.createdAt)],
)

/** Avaliação antropométrica. Medidas numéricas para permitir gráficos de evolução. */
export const measurement = pgTable(
  "measurement",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    measuredOn: date("measured_on", { mode: "string" }).notNull(),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2, mode: "number" }),
    heightCm: numeric("height_cm", { precision: 5, scale: 1, mode: "number" }),
    waistCm: numeric("waist_cm", { precision: 5, scale: 1, mode: "number" }),
    hipCm: numeric("hip_cm", { precision: 5, scale: 1, mode: "number" }),
    bodyFatPct: numeric("body_fat_pct", { precision: 4, scale: 1, mode: "number" }),
    muscleMassKg: numeric("muscle_mass_kg", { precision: 5, scale: 2, mode: "number" }),
    createdAt: createdAt(),
  },
  (t) => [index("measurement_contact_idx").on(t.contactId, t.measuredOn)],
)

export const documentKind = pgEnum("document_kind", ["receipt", "attendance", "certificate", "prescription"])

/**
 * Documento emitido (recibo, declaração de comparecimento). Guarda os dados
 * do momento da emissão, então o PDF pode ser gerado de novo idêntico.
 */
export const issuedDocument = pgTable(
  "issued_document",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    issuedById: text("issued_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    kind: documentKind("kind").notNull(),
    /** Numeração sequencial por organização. */
    number: integer("number").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("issued_document_org_number_uq").on(t.organizationId, t.number),
    index("issued_document_contact_idx").on(t.contactId, t.createdAt),
  ],
)

/* -------------------------------------------------------------------------- */
/*                   Odontograma, procedimentos e tratamentos                  */
/* -------------------------------------------------------------------------- */

/**
 * Situação atual de um dente (numeração FDI). Uma linha por dente alterado;
 * dentes sem linha são considerados hígidos.
 */
export const toothRecord = pgTable(
  "tooth_record",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    tooth: smallint("tooth").notNull(),
    /** Ver TOOTH_STATUSES em src/lib/dental.ts. */
    status: text("status").notNull().default("healthy"),
    /** Condição por face: { O: "caries", M: "restored" }. */
    surfaces: jsonb("surfaces").$type<Record<string, string>>().notNull().default({}),
    notes: text("notes"),
    updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("tooth_record_contact_tooth_uq").on(t.contactId, t.tooth)],
)

/** Catálogo de procedimentos e preços da organização. */
export const procedure = pgTable(
  "procedure",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    /** Efeito no odontograma ao concluir (ver PROCEDURE_EFFECTS). */
    effect: text("effect"),
    /** Se o procedimento é por dente (pede o número do dente no orçamento). */
    perTooth: boolean("per_tooth").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("procedure_org_idx").on(t.organizationId)],
)

export const treatmentPlanStatus = pgEnum("treatment_plan_status", [
  "draft",
  "presented",
  "approved",
  "rejected",
  "completed",
])

/** Plano de tratamento / orçamento. */
export const treatmentPlan = pgTable(
  "treatment_plan",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    status: treatmentPlanStatus("status").notNull().default("draft"),
    discountCents: integer("discount_cents").notNull().default(0),
    notes: text("notes"),
    /** Link público para o paciente ver e aprovar o orçamento. */
    approvalToken: text("approval_token")
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID().replaceAll("-", "")),
    validUntil: date("valid_until", { mode: "string" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Nome digitado pelo paciente ao aprovar (aceite eletrônico simples). */
    approvedByName: text("approved_by_name"),
    approvedIp: text("approved_ip"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("treatment_plan_contact_idx").on(t.contactId, t.createdAt)],
)

export const treatmentItem = pgTable(
  "treatment_item",
  {
    id: id(),
    planId: text("plan_id")
      .notNull()
      .references(() => treatmentPlan.id, { onDelete: "cascade" }),
    procedureId: text("procedure_id").references(() => procedure.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    tooth: smallint("tooth"),
    /** Faces envolvidas, ex.: "MO". */
    surfaces: text("surfaces"),
    priceCents: integer("price_cents").notNull(),
    position: integer("position").notNull().default(0),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneById: text("done_by_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("treatment_item_plan_idx").on(t.planId, t.position)],
)

/* -------------------------------------------------------------------------- */
/*                                  Relations                                 */
/* -------------------------------------------------------------------------- */

export const userRelations = relations(user, ({ many }) => ({
  memberships: many(membership),
  schedules: many(schedule),
  eventTypes: many(eventType),
}))

export const organizationRelations = relations(organization, ({ many }) => ({
  memberships: many(membership),
  eventTypes: many(eventType),
  contacts: many(contact),
  bookings: many(booking),
}))

export const membershipRelations = relations(membership, ({ one }) => ({
  organization: one(organization, {
    fields: [membership.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [membership.userId], references: [user.id] }),
}))

export const scheduleRelations = relations(schedule, ({ one, many }) => ({
  user: one(user, { fields: [schedule.userId], references: [user.id] }),
  rules: many(availabilityRule),
  overrides: many(dateOverride),
}))

export const availabilityRuleRelations = relations(availabilityRule, ({ one }) => ({
  schedule: one(schedule, { fields: [availabilityRule.scheduleId], references: [schedule.id] }),
}))

export const dateOverrideRelations = relations(dateOverride, ({ one }) => ({
  schedule: one(schedule, { fields: [dateOverride.scheduleId], references: [schedule.id] }),
}))

export const eventTypeRelations = relations(eventType, ({ one, many }) => ({
  organization: one(organization, {
    fields: [eventType.organizationId],
    references: [organization.id],
  }),
  host: one(user, { fields: [eventType.hostId], references: [user.id] }),
  schedule: one(schedule, { fields: [eventType.scheduleId], references: [schedule.id] }),
  bookings: many(booking),
}))

export const contactRelations = relations(contact, ({ one, many }) => ({
  organization: one(organization, {
    fields: [contact.organizationId],
    references: [organization.id],
  }),
  bookings: many(booking),
  notes: many(clinicalNote),
  attachments: many(attachment),
  anamneses: many(anamnesis),
  measurements: many(measurement),
  documents: many(issuedDocument),
  teeth: many(toothRecord),
  treatmentPlans: many(treatmentPlan),
  payments: many(payment),
}))

export const toothRecordRelations = relations(toothRecord, ({ one }) => ({
  contact: one(contact, { fields: [toothRecord.contactId], references: [contact.id] }),
  updatedBy: one(user, { fields: [toothRecord.updatedById], references: [user.id] }),
}))

export const treatmentPlanRelations = relations(treatmentPlan, ({ one, many }) => ({
  contact: one(contact, { fields: [treatmentPlan.contactId], references: [contact.id] }),
  organization: one(organization, {
    fields: [treatmentPlan.organizationId],
    references: [organization.id],
  }),
  createdBy: one(user, { fields: [treatmentPlan.createdById], references: [user.id] }),
  items: many(treatmentItem),
}))

export const treatmentItemRelations = relations(treatmentItem, ({ one }) => ({
  plan: one(treatmentPlan, { fields: [treatmentItem.planId], references: [treatmentPlan.id] }),
  procedure: one(procedure, { fields: [treatmentItem.procedureId], references: [procedure.id] }),
}))

export const bookingSeriesRelations = relations(bookingSeries, ({ one, many }) => ({
  contact: one(contact, { fields: [bookingSeries.contactId], references: [contact.id] }),
  eventType: one(eventType, { fields: [bookingSeries.eventTypeId], references: [eventType.id] }),
  bookings: many(booking),
}))

export const anamnesisRelations = relations(anamnesis, ({ one }) => ({
  contact: one(contact, { fields: [anamnesis.contactId], references: [contact.id] }),
  organization: one(organization, {
    fields: [anamnesis.organizationId],
    references: [organization.id],
  }),
}))

export const measurementRelations = relations(measurement, ({ one }) => ({
  contact: one(contact, { fields: [measurement.contactId], references: [contact.id] }),
  author: one(user, { fields: [measurement.authorId], references: [user.id] }),
}))

export const issuedDocumentRelations = relations(issuedDocument, ({ one }) => ({
  contact: one(contact, { fields: [issuedDocument.contactId], references: [contact.id] }),
  issuedBy: one(user, { fields: [issuedDocument.issuedById], references: [user.id] }),
}))

export const clinicalNoteRelations = relations(clinicalNote, ({ one }) => ({
  contact: one(contact, { fields: [clinicalNote.contactId], references: [contact.id] }),
  author: one(user, { fields: [clinicalNote.authorId], references: [user.id] }),
  booking: one(booking, { fields: [clinicalNote.bookingId], references: [booking.id] }),
}))

export const attachmentRelations = relations(attachment, ({ one }) => ({
  contact: one(contact, { fields: [attachment.contactId], references: [contact.id] }),
  uploadedBy: one(user, { fields: [attachment.uploadedById], references: [user.id] }),
}))

export const accessLogRelations = relations(accessLog, ({ one }) => ({
  user: one(user, { fields: [accessLog.userId], references: [user.id] }),
  contact: one(contact, { fields: [accessLog.contactId], references: [contact.id] }),
}))

export const paymentRelations = relations(payment, ({ one }) => ({
  contact: one(contact, { fields: [payment.contactId], references: [contact.id] }),
  booking: one(booking, { fields: [payment.bookingId], references: [booking.id] }),
}))

export const bookingRelations = relations(booking, ({ one }) => ({
  eventType: one(eventType, { fields: [booking.eventTypeId], references: [eventType.id] }),
  host: one(user, { fields: [booking.hostId], references: [user.id] }),
  contact: one(contact, { fields: [booking.contactId], references: [contact.id] }),
  organization: one(organization, {
    fields: [booking.organizationId],
    references: [organization.id],
  }),
  series: one(bookingSeries, { fields: [booking.seriesId], references: [bookingSeries.id] }),
}))
