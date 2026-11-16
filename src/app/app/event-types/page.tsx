import type { Metadata } from "next"
import Link from "next/link"
import { asc, eq } from "drizzle-orm"
import { ExternalLinkIcon, PlusIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { EventTypeCard } from "@/components/app/event-type-card"
import { db, schema } from "@/db"
import { initials } from "@/lib/format"
import { requireWorkspace } from "@/lib/session"

export const metadata: Metadata = { title: "Tipos de evento" }

export default async function EventTypesPage() {
  const { user, org } = await requireWorkspace()
  const eventTypes = await db.query.eventType.findMany({
    where: eq(schema.eventType.organizationId, org.id),
    orderBy: [asc(schema.eventType.createdAt)],
  })

  return (
    <>
      <PageHeader
        title="Tipos de evento"
        description="Crie modelos de evento e compartilhe o link para receber agendamentos."
        actions={
          <Button asChild className="h-10 rounded-full px-5">
            <Link href="/app/event-types/new">
              <PlusIcon /> Novo tipo de evento
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">nautly.app/{user.username}</p>
          </div>
        </div>
        <Button asChild variant="link" className="shrink-0">
          <Link href={`/${user.username}`} target="_blank">
            Ver página pública <ExternalLinkIcon />
          </Link>
        </Button>
      </div>

      {eventTypes.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center">
          <p className="font-semibold">Nenhum tipo de evento ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie o primeiro para começar a receber agendamentos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {eventTypes.map((et) => (
            <EventTypeCard key={et.id} eventType={et} username={user.username ?? ""} />
          ))}
        </div>
      )}
    </>
  )
}
