import { NextResponse, type NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { logAccess } from "@/lib/audit"
import { requireWorkspace } from "@/lib/session"
import { storage } from "@/lib/storage"

export async function GET(request: NextRequest, { params }: RouteContext<"/api/attachments/[id]">) {
  const { id } = await params
  const ctx = await requireWorkspace()
  if (!ctx.canUseModule("attachments")) return new NextResponse("Sem permissão", { status: 403 })

  const file = await db.query.attachment.findFirst({
    where: and(eq(schema.attachment.id, id), eq(schema.attachment.organizationId, ctx.org.id)),
  })
  if (!file) return new NextResponse("Não encontrado", { status: 404 })

  const data = await storage.get(file.storageKey)
  await logAccess({
    organizationId: ctx.org.id,
    userId: ctx.user.id,
    contactId: file.contactId,
    action: "attachment_downloaded",
    targetId: file.id,
  })

  const inline = request.nextUrl.searchParams.get("inline") === "1"
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
