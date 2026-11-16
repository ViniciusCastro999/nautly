import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { logAccess } from "@/lib/audit"
import { requireWorkspace } from "@/lib/session"
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, storage } from "@/lib/storage"

const CATEGORIES = new Set(schema.attachmentCategory.enumValues)

export async function POST(request: Request, { params }: RouteContext<"/api/contacts/[id]/attachments">) {
  const { id: contactId } = await params
  const ctx = await requireWorkspace()
  if (!ctx.hasModule("attachments") || !ctx.can("clinical:write")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 })
  }

  const contact = await db.query.contact.findFirst({
    where: and(eq(schema.contact.id, contactId), eq(schema.contact.organizationId, ctx.org.id)),
  })
  if (!contact) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 })

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "O arquivo deve ter até 10 MB." }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Formato não suportado. Envie PDF ou imagem." }, { status: 400 })
  }
  const rawCategory = String(form.get("category") ?? "other")
  const category = (
    CATEGORIES.has(rawCategory as never) ? rawCategory : "other"
  ) as (typeof schema.attachmentCategory.enumValues)[number]
  const description =
    String(form.get("description") ?? "")
      .trim()
      .slice(0, 300) || null

  const storageKey = `${ctx.org.id}/${crypto.randomUUID()}`
  await storage.put(storageKey, Buffer.from(await file.arrayBuffer()))

  const [row] = await db
    .insert(schema.attachment)
    .values({
      organizationId: ctx.org.id,
      contactId,
      uploadedById: ctx.user.id,
      fileName: file.name.slice(0, 200),
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey,
      category,
      description,
    })
    .returning({ id: schema.attachment.id })

  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId,
    action: "attachment_uploaded",
    targetId: row.id,
  })
  return NextResponse.json({ id: row.id })
}
