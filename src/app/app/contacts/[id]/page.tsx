import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, desc, eq, or } from "drizzle-orm"
import { differenceInYears, parseISO } from "date-fns"
import {
  ArrowLeftIcon,
  CakeIcon,
  ClipboardCheckIcon,
  CalendarPlusIcon,
  ClipboardListIcon,
  FileTextIcon,
  ReceiptIcon,
  RepeatIcon,
  RulerIcon,
  IdCardIcon,
  LockIcon,
  MailIcon,
  PaperclipIcon,
  PencilIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SmileIcon,
  UserIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContactFormDialog } from "@/components/app/contacts/contact-form-dialog"
import { NotesPanel } from "@/components/app/contacts/notes-panel"
import { AttachmentsPanel } from "@/components/app/contacts/attachments-panel"
import { AnamnesisPanel, type AnamnesisView } from "@/components/app/contacts/anamnesis-panel"
import { MeasurementsPanel } from "@/components/app/contacts/measurements-panel"
import { DocumentsPanel } from "@/components/app/contacts/documents-panel"
import { TreatmentsPanel, type PlanView } from "@/components/app/contacts/treatments-panel"
import { OdontogramPanel, type ToothView } from "@/components/app/contacts/odontogram-panel"
import { NewBookingDialog } from "@/components/app/new-booking-dialog"
import { db, schema } from "@/db"
import { ACCESS_ACTION_LABELS, logAccess } from "@/lib/audit"
import { formatAnswer, getTemplate, isVisible, type Answers } from "@/lib/anamnesis"
import { decryptText } from "@/lib/crypto"
import { formatBRL } from "@/lib/documents/money"
import { canIssueClinicalDocs } from "@/lib/documents/kinds"
import type { DocumentPayload } from "@/lib/documents/pdf"
import { isSurfaceCondition, isToothStatus, isValidTooth, parseSurfaces } from "@/lib/dental"
import { formatInTz, initials } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Ficha", robots: { index: false } }

type TabKey =
  | "overview"
  | "records"
  | "anamnesis"
  | "odontogram"
  | "treatments"
  | "measurements"
  | "attachments"
  | "documents"
  | "access"

export default async function ContactPage({ params, searchParams }: PageProps<"/app/contacts/[id]">) {
  const { id } = await params
  const { tab: rawTab, tooth: rawTooth } = await searchParams
  const ctx = await requireWorkspace()
  const { org, user, vocab } = ctx

  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, id), eq(schema.contact.organizationId, org.id)),
  })
  if (!contact) notFound()

  const tabs: { key: TabKey; label: string; icon: typeof UserIcon }[] = [
    { key: "overview", label: "Visão geral", icon: UserIcon },
    ...(ctx.canUseModule("records")
      ? [{ key: "records" as const, label: "Prontuário", icon: FileTextIcon }]
      : []),
    ...(ctx.canUseModule("anamnesis")
      ? [{ key: "anamnesis" as const, label: "Anamnese", icon: ClipboardListIcon }]
      : []),
    ...(ctx.canUseModule("odontogram")
      ? [{ key: "odontogram" as const, label: "Odontograma", icon: SmileIcon }]
      : []),
    ...(ctx.canUseModule("treatment_plan")
      ? [{ key: "treatments" as const, label: "Tratamentos", icon: ClipboardCheckIcon }]
      : []),
    ...(ctx.canUseModule("anthropometry")
      ? [{ key: "measurements" as const, label: "Avaliações", icon: RulerIcon }]
      : []),
    ...(ctx.canUseModule("attachments")
      ? [{ key: "attachments" as const, label: "Anexos", icon: PaperclipIcon }]
      : []),
    ...(ctx.hasModule("documents") && ctx.can("clients:write")
      ? [{ key: "documents" as const, label: "Documentos", icon: ReceiptIcon }]
      : []),
    ...(ctx.can("audit:read") && ctx.org.modules.length > 0
      ? [{ key: "access" as const, label: "Acessos", icon: ShieldCheckIcon }]
      : []),
  ]
  const tab: TabKey = tabs.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "overview"

  const bookings = await db.query.booking.findMany({
    where: eq(schema.booking.contactId, contact.id),
    with: { eventType: true },
    orderBy: [desc(schema.booking.startsAt)],
  })
  const now = new Date()
  const confirmed = bookings.filter((b) => b.status === "confirmed")
  const upcoming = confirmed.filter((b) => b.startsAt > now)
  const past = confirmed.filter((b) => b.startsAt <= now)
  const attended = past.filter((b) => b.attendance !== "no_show")
  const noShows = past.filter((b) => b.attendance === "no_show").length
  const age = contact.birthDate ? differenceInYears(now, parseISO(contact.birthDate)) : null
  const eventTypes = (
    await db.query.eventType.findMany({
      where: and(eq(schema.eventType.organizationId, org.id), eq(schema.eventType.hostId, user.id)),
      orderBy: [asc(schema.eventType.createdAt)],
    })
  ).map((et) => ({ id: et.id, title: et.title, durationMinutes: et.durationMinutes, color: et.color }))

  return (
    <>
      <Link
        href="/app/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> {vocab.clients}
      </Link>

      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
            {initials(contact.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{contact.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {age !== null && (
              <span className="flex items-center gap-1.5">
                <CakeIcon className="size-4" /> {age} anos
              </span>
            )}
            {contact.phone && (
              <span className="flex items-center gap-1.5">
                <PhoneIcon className="size-4" /> {contact.phone}
              </span>
            )}
            {contact.email && (
              <span className="flex items-center gap-1.5">
                <MailIcon className="size-4" /> {contact.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 text-center sm:pr-2">
          <div>
            <p className="text-2xl font-bold tabular-nums">{attended.length}</p>
            <p className="text-xs text-muted-foreground">Realizadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">Agendadas</p>
          </div>
          {noShows > 0 && (
            <div>
              <p className="text-2xl font-bold text-destructive tabular-nums">{noShows}</p>
              <p className="text-xs text-muted-foreground">{noShows === 1 ? "Falta" : "Faltas"}</p>
            </div>
          )}
          {ctx.can("agenda:manage") && (
            <NewBookingDialog
              contact={{ id: contact.id, name: contact.name }}
              eventTypes={eventTypes}
              recurringEnabled={ctx.hasModule("recurring")}
              defaultDate={formatInTz(now, user.timezone, "yyyy-MM-dd")}
              clientNoun={vocab.client}
            >
              <Button className="rounded-full">
                <CalendarPlusIcon /> Agendar
              </Button>
            </NewBookingDialog>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/app/contacts/${contact.id}${key === "overview" ? "" : `?tab=${key}`}`}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="overflow-hidden rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-semibold">
              Histórico de {vocab.appointments.toLowerCase()}
            </h2>
            {bookings.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nenhum agendamento ainda.</p>
            ) : (
              <ul className="divide-y">
                {bookings.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: b.eventType.color }}
                    />
                    <span className="w-36 shrink-0 tabular-nums">
                      {formatInTz(b.startsAt, user.timezone, "dd/MM/yyyy HH:mm")}
                    </span>
                    <span
                      className={cn("min-w-0 flex-1 truncate", b.status === "cancelled" && "line-through")}
                    >
                      {b.eventType.title}
                    </span>
                    {b.seriesId && (
                      <RepeatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Recorrente" />
                    )}
                    {b.status === "cancelled" ? (
                      <Badge variant="secondary">Cancelado</Badge>
                    ) : b.startsAt > now ? (
                      <Badge className="bg-accent text-accent-foreground">Agendado</Badge>
                    ) : b.attendance === "no_show" ? (
                      <Badge variant="outline" className="border-destructive text-destructive">
                        Faltou
                      </Badge>
                    ) : (
                      <Badge variant="outline">Realizado</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="h-fit rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Cadastro</h2>
              {ctx.can("clients:write") && (
                <ContactFormDialog
                  clientNoun={vocab.client}
                  contact={{
                    id: contact.id,
                    name: contact.name,
                    email: contact.email ?? "",
                    phone: contact.phone ?? "",
                    birthDate: contact.birthDate ?? "",
                    document: contact.document ?? "",
                    notes: contact.notes ?? "",
                  }}
                >
                  <Button variant="ghost" size="sm">
                    <PencilIcon /> Editar
                  </Button>
                </ContactFormDialog>
              )}
            </div>
            <dl className="grid gap-3 text-sm">
              {[
                { icon: MailIcon, label: "E-mail", value: contact.email },
                { icon: PhoneIcon, label: "Telefone", value: contact.phone },
                {
                  icon: CakeIcon,
                  label: "Nascimento",
                  value:
                    contact.birthDate && formatInTz(`${contact.birthDate}T12:00:00Z`, "UTC", "dd/MM/yyyy"),
                },
                { icon: IdCardIcon, label: "CPF", value: contact.document },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd>{value || "-"}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {contact.notes && (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
                {contact.notes}
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "records" && (
        <RecordsTab
          contactId={contact.id}
          orgId={org.id}
          userId={user.id}
          timezone={user.timezone}
          canWrite={ctx.can("clinical:write")}
          bookings={past.slice(0, 20).map((b) => ({
            id: b.id,
            label: `${formatInTz(b.startsAt, user.timezone, "dd/MM/yyyy HH:mm")} · ${b.eventType.title}`,
          }))}
        />
      )}

      {tab === "anamnesis" && (
        <AnamnesisTab
          contact={contact}
          orgId={org.id}
          userId={user.id}
          timezone={user.timezone}
          canWrite={ctx.can("clinical:write")}
        />
      )}

      {tab === "odontogram" && (
        <OdontogramTab
          contactId={contact.id}
          orgId={org.id}
          userId={user.id}
          timezone={user.timezone}
          canWrite={ctx.can("clinical:write")}
          treatmentHref={
            ctx.canUseModule("treatment_plan") ? `/app/contacts/${contact.id}?tab=treatments` : null
          }
        />
      )}

      {tab === "treatments" && (
        <TreatmentsTab
          contact={contact}
          orgId={org.id}
          timezone={user.timezone}
          canWrite={ctx.can("clinical:write")}
          dental={ctx.hasModule("odontogram")}
          tooth={typeof rawTooth === "string" ? Number(rawTooth) : null}
        />
      )}

      {tab === "measurements" && (
        <MeasurementsTab
          contactId={contact.id}
          orgId={org.id}
          userId={user.id}
          timezone={user.timezone}
          canWrite={ctx.can("clinical:write")}
        />
      )}

      {tab === "documents" && (
        <DocumentsTab
          contactId={contact.id}
          orgId={org.id}
          timezone={user.timezone}
          profileIncomplete={!user.taxId || !user.address}
          clinicalDocs={canIssueClinicalDocs(ctx.vertical.id) && ctx.can("clinical:write")}
          canReadClinical={ctx.can("clinical:read")}
          bookings={attended.map((b) => ({
            id: b.id,
            label: `${formatInTz(b.startsAt, user.timezone, "dd/MM/yyyy HH:mm")} · ${b.eventType.title}`,
            priceCents: b.eventType.priceCents,
          }))}
        />
      )}

      {tab === "attachments" && (
        <AttachmentsTab
          contactId={contact.id}
          orgId={org.id}
          timezone={user.timezone}
          canWrite={ctx.can("clinical:write")}
        />
      )}

      {tab === "access" && (
        <AccessTab
          contactId={contact.id}
          orgId={org.id}
          timezone={user.timezone}
          clientNoun={vocab.client.charAt(0).toUpperCase() + vocab.client.slice(1)}
        />
      )}
    </>
  )
}

async function RecordsTab(props: {
  contactId: string
  orgId: string
  userId: string
  timezone: string
  canWrite: boolean
  bookings: { id: string; label: string }[]
}) {
  await logAccess({
    organizationId: props.orgId,
    userId: props.userId,
    contactId: props.contactId,
    action: "record_viewed",
  })

  const notes = await db.query.clinicalNote.findMany({
    where: and(
      eq(schema.clinicalNote.contactId, props.contactId),
      eq(schema.clinicalNote.organizationId, props.orgId),
      // Anotações privadas só aparecem para o autor.
      or(eq(schema.clinicalNote.isPrivate, false), eq(schema.clinicalNote.authorId, props.userId)),
    ),
    with: { author: true, booking: { with: { eventType: true } } },
    orderBy: [desc(schema.clinicalNote.createdAt)],
  })

  return (
    <NotesPanel
      contactId={props.contactId}
      canWrite={props.canWrite}
      bookings={props.bookings}
      notes={notes.map((n) => ({
        id: n.id,
        content: decryptText(n.contentEncrypted),
        isPrivate: n.isPrivate,
        isMine: n.authorId === props.userId,
        authorName: n.author.name,
        createdAt: formatInTz(n.createdAt, props.timezone, "dd/MM/yyyy 'às' HH:mm"),
        edited: n.updatedAt.getTime() - n.createdAt.getTime() > 1000,
        bookingLabel: n.booking
          ? `${n.booking.eventType.title} de ${formatInTz(n.booking.startsAt, props.timezone, "dd/MM")}`
          : null,
      }))}
    />
  )
}

async function AttachmentsTab(props: {
  contactId: string
  orgId: string
  timezone: string
  canWrite: boolean
}) {
  const files = await db.query.attachment.findMany({
    where: and(
      eq(schema.attachment.contactId, props.contactId),
      eq(schema.attachment.organizationId, props.orgId),
    ),
    with: { uploadedBy: true },
    orderBy: [desc(schema.attachment.createdAt)],
  })
  return (
    <AttachmentsPanel
      contactId={props.contactId}
      canWrite={props.canWrite}
      files={files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        category: f.category,
        description: f.description,
        uploadedBy: f.uploadedBy.name,
        createdAt: formatInTz(f.createdAt, props.timezone, "dd/MM/yyyy"),
      }))}
    />
  )
}

async function AccessTab(props: { contactId: string; orgId: string; timezone: string; clientNoun: string }) {
  const logs = await db.query.accessLog.findMany({
    where: and(
      eq(schema.accessLog.contactId, props.contactId),
      eq(schema.accessLog.organizationId, props.orgId),
    ),
    with: { user: true },
    orderBy: [desc(schema.accessLog.createdAt)],
    limit: 100,
  })
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <LockIcon className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">Registro de acessos</h2>
          <p className="text-sm text-muted-foreground">
            Toda visualização ou alteração de dado sensível fica registrada, conforme a LGPD. Últimos 100
            eventos.
          </p>
        </div>
      </div>
      {logs.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nenhum acesso registrado.</p>
      ) : (
        <ul className="divide-y text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="w-36 shrink-0 text-muted-foreground tabular-nums">
                {formatInTz(l.createdAt, props.timezone, "dd/MM/yyyy HH:mm")}
              </span>
              <span className="font-medium">{l.user?.name ?? `${props.clientNoun} (pelo link)`}</span>
              <span className="text-muted-foreground">{ACCESS_ACTION_LABELS[l.action]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

async function AnamnesisTab(props: {
  contact: { id: string; name: string; phone: string | null }
  orgId: string
  userId: string
  timezone: string
  canWrite: boolean
}) {
  const rows = await db.query.anamnesis.findMany({
    where: and(
      eq(schema.anamnesis.contactId, props.contact.id),
      eq(schema.anamnesis.organizationId, props.orgId),
    ),
    orderBy: [desc(schema.anamnesis.createdAt)],
  })
  if (rows.some((r) => r.status === "completed")) {
    await logAccess({
      organizationId: props.orgId,
      userId: props.userId,
      contactId: props.contact.id,
      action: "anamnesis_viewed",
    })
  }

  const forms: AnamnesisView[] = rows.map((r) => {
    const template = getTemplate(r.templateId)
    const answers: Answers = r.answersEncrypted ? JSON.parse(decryptText(r.answersEncrypted)) : {}
    return {
      id: r.id,
      title: template.title,
      token: r.token,
      status: r.status,
      filledBy: r.filledBy,
      createdAt: formatInTz(r.createdAt, props.timezone, "dd/MM/yyyy"),
      completedAt: r.completedAt ? formatInTz(r.completedAt, props.timezone, "dd/MM/yyyy") : null,
      template: r.status === "pending" ? template : undefined,
      sections:
        r.status === "completed"
          ? template.sections.map((s) => ({
              title: s.title,
              items: s.fields
                .filter((f) => isVisible(f, answers))
                .map((f) => ({ label: f.label, value: formatAnswer(f, answers[f.id]) })),
            }))
          : undefined,
    }
  })

  return (
    <AnamnesisPanel
      contactId={props.contact.id}
      contactName={props.contact.name}
      contactPhone={props.contact.phone}
      canWrite={props.canWrite}
      forms={forms}
    />
  )
}

async function MeasurementsTab(props: {
  contactId: string
  orgId: string
  userId: string
  timezone: string
  canWrite: boolean
}) {
  const rows = await db.query.measurement.findMany({
    where: and(
      eq(schema.measurement.contactId, props.contactId),
      eq(schema.measurement.organizationId, props.orgId),
    ),
    orderBy: [asc(schema.measurement.measuredOn), asc(schema.measurement.createdAt)],
  })
  return (
    <MeasurementsPanel
      contactId={props.contactId}
      canWrite={props.canWrite}
      today={formatInTz(new Date(), props.timezone, "yyyy-MM-dd")}
      measurements={rows.map((m) => ({
        id: m.id,
        measuredOn: m.measuredOn,
        label: formatInTz(`${m.measuredOn}T12:00:00Z`, "UTC", "dd/MM/yyyy"),
        isMine: m.authorId === props.userId,
        weightKg: m.weightKg,
        heightCm: m.heightCm,
        waistCm: m.waistCm,
        hipCm: m.hipCm,
        bodyFatPct: m.bodyFatPct,
        muscleMassKg: m.muscleMassKg,
      }))}
    />
  )
}

async function DocumentsTab(props: {
  contactId: string
  orgId: string
  timezone: string
  profileIncomplete: boolean
  clinicalDocs: boolean
  canReadClinical: boolean
  bookings: { id: string; label: string; priceCents: number | null }[]
}) {
  const docs = await db.query.issuedDocument.findMany({
    where: and(
      eq(schema.issuedDocument.contactId, props.contactId),
      eq(schema.issuedDocument.organizationId, props.orgId),
    ),
    orderBy: [desc(schema.issuedDocument.number)],
  })
  return (
    <DocumentsPanel
      contactId={props.contactId}
      canWrite
      profileIncomplete={props.profileIncomplete}
      clinicalDocs={props.clinicalDocs}
      bookings={props.bookings}
      documents={docs
        // Atestados e receitas ficam ocultos para quem não acessa dados clínicos.
        .filter((d) => props.canReadClinical || (d.kind !== "certificate" && d.kind !== "prescription"))
        .map((d) => {
          const payload = d.payload as DocumentPayload
          return {
            id: d.id,
            kind: d.kind,
            number: d.number,
            createdAt: formatInTz(d.createdAt, props.timezone, "dd/MM/yyyy"),
            summary: documentSummary(payload),
          }
        })}
    />
  )
}

async function OdontogramTab(props: {
  contactId: string
  orgId: string
  userId: string
  timezone: string
  canWrite: boolean
  treatmentHref: string | null
}) {
  await logAccess({
    organizationId: props.orgId,
    userId: props.userId,
    contactId: props.contactId,
    action: "record_viewed",
  })
  const rows = await db.query.toothRecord.findMany({
    where: and(
      eq(schema.toothRecord.contactId, props.contactId),
      eq(schema.toothRecord.organizationId, props.orgId),
    ),
    with: { updatedBy: true },
  })
  const teeth: Record<number, ToothView> = {}
  for (const r of rows) {
    teeth[r.tooth] = {
      status: isToothStatus(r.status) ? r.status : "healthy",
      surfaces: Object.fromEntries(
        Object.entries(r.surfaces ?? {}).filter(
          ([s, c]) => parseSurfaces(s).length === 1 && isSurfaceCondition(c),
        ),
      ) as ToothView["surfaces"],
      notes: r.notes,
      updatedLabel: `em ${formatInTz(r.updatedAt, props.timezone, "dd/MM/yyyy")}${r.updatedBy ? ` por ${r.updatedBy.name}` : ""}`,
    }
  }
  return (
    <OdontogramPanel
      contactId={props.contactId}
      canWrite={props.canWrite}
      treatmentHref={props.treatmentHref}
      teeth={teeth}
    />
  )
}

async function TreatmentsTab(props: {
  contact: { id: string; name: string; phone: string | null }
  orgId: string
  timezone: string
  canWrite: boolean
  dental: boolean
  tooth: number | null
}) {
  const [plans, procedures] = await Promise.all([
    db.query.treatmentPlan.findMany({
      where: and(
        eq(schema.treatmentPlan.contactId, props.contact.id),
        eq(schema.treatmentPlan.organizationId, props.orgId),
      ),
      with: { items: { orderBy: [asc(schema.treatmentItem.position)] } },
      orderBy: [desc(schema.treatmentPlan.createdAt)],
    }),
    db.query.procedure.findMany({
      where: and(eq(schema.procedure.organizationId, props.orgId), eq(schema.procedure.isActive, true)),
      orderBy: [asc(schema.procedure.name)],
    }),
  ])
  const fmt = (d: Date) => formatInTz(d, props.timezone, "dd/MM/yyyy")
  const views: PlanView[] = plans.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    discountCents: p.discountCents,
    notes: p.notes,
    validUntil: p.validUntil,
    validUntilLabel: p.validUntil ? formatInTz(`${p.validUntil}T12:00:00Z`, "UTC", "dd/MM/yyyy") : null,
    token: p.approvalToken,
    createdAt: fmt(p.createdAt),
    approvedLabel: p.approvedAt ? `aprovado em ${fmt(p.approvedAt)} por ${p.approvedByName}` : null,
    items: p.items.map((i) => ({
      id: i.id,
      description: i.description,
      tooth: i.tooth,
      surfaces: i.surfaces,
      priceCents: i.priceCents,
      doneLabel: i.doneAt ? `em ${fmt(i.doneAt)}` : null,
    })),
  }))
  return (
    <TreatmentsPanel
      contactId={props.contact.id}
      contactName={props.contact.name}
      contactPhone={props.contact.phone}
      canWrite={props.canWrite}
      dental={props.dental}
      initialTooth={props.tooth !== null && isValidTooth(props.tooth) ? props.tooth : null}
      procedures={procedures.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        perTooth: p.perTooth && props.dental,
        needsSurfaces: props.dental && (p.effect === "restoration" || p.effect === "sealant"),
      }))}
      plans={views}
    />
  )
}

function documentSummary(p: DocumentPayload) {
  switch (p.kind) {
    case "receipt":
      return `${formatBRL(p.totalCents)} · ${p.items.length} ${p.items.length === 1 ? "atendimento" : "atendimentos"}`
    case "attendance":
      return `${p.date}, ${p.start} às ${p.end}`
    case "certificate":
      return `${p.date}${p.days ? ` · ${p.days} ${p.days === 1 ? "dia" : "dias"} de afastamento` : ""}`
    case "prescription":
      return `${p.items.length} ${p.items.length === 1 ? "item" : "itens"} · ${p.usage.toLowerCase()}`
  }
}
