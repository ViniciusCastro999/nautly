import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { DOCUMENT_FILE_NAMES } from "@/lib/documents/kinds"
import { renderDocumentPdf, type DocumentPayload } from "@/lib/documents/pdf"
import { requireWorkspace } from "@/lib/session"

export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const { id } = await params
  const ctx = await requireWorkspace()
  if (!ctx.hasModule("documents") || !ctx.can("clients:read")) {
    return new NextResponse("Sem permissão", { status: 403 })
  }

  const doc = await db.query.issuedDocument.findFirst({
    where: and(eq(schema.issuedDocument.id, id), eq(schema.issuedDocument.organizationId, ctx.org.id)),
  })
  if (!doc) return new NextResponse("Não encontrado", { status: 404 })
  // Atestado e receita contêm dado de saúde.
  if ((doc.kind === "certificate" || doc.kind === "prescription") && !ctx.can("clinical:read")) {
    return new NextResponse("Sem permissão", { status: 403 })
  }

  const pdf = await renderDocumentPdf(doc.payload as DocumentPayload, doc.number)
  const name = `${DOCUMENT_FILE_NAMES[doc.kind]}-${String(doc.number).padStart(4, "0")}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
