import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"
import { ChevronRightIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PublicShell } from "@/components/booking/public-shell"
import { db, schema } from "@/db"
import { LOCATION_LABELS } from "@/lib/constants"
import { formatDuration, initials } from "@/lib/format"

async function load(username: string) {
  const host = await db.query.user.findFirst({ where: eq(schema.user.username, username.toLowerCase()) })
  if (!host) return null
  const eventTypes = await db.query.eventType.findMany({
    where: and(eq(schema.eventType.hostId, host.id), eq(schema.eventType.isActive, true)),
    orderBy: [asc(schema.eventType.createdAt)],
  })
  return { host, eventTypes }
}

export async function generateMetadata({ params }: PageProps<"/[username]">): Promise<Metadata> {
  const data = await load((await params).username)
  return data ? { title: `Agende com ${data.host.name}` } : {}
}

export default async function PublicProfilePage({ params }: PageProps<"/[username]">) {
  const { username } = await params
  const data = await load(username)
  if (!data) notFound()
  const { host, eventTypes } = data

  return (
    <PublicShell>
      <div className="w-full max-w-4xl rounded-2xl border bg-card p-6 shadow-[0_1px_8px_rgba(0,0,0,0.08)] sm:p-10 dark:shadow-none">
        <div className="mb-10 flex flex-col items-center text-center">
          <Avatar className="mb-4 size-16">
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initials(host.name)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold">{host.name}</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            Bem-vindo à minha página de agendamento. Escolha um tipo de evento abaixo para reservar um
            horário.
          </p>
        </div>
        {eventTypes.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhum evento disponível no momento.</p>
        ) : (
          <div className="grid gap-4 border-t pt-8 sm:grid-cols-2">
            {eventTypes.map((et) => (
              <Link
                key={et.id}
                href={`/${host.username}/${et.slug}`}
                className="group flex items-center gap-4 rounded-xl border p-5 transition-colors hover:border-primary hover:bg-accent/40"
              >
                <span className="size-6 shrink-0 rounded-full" style={{ backgroundColor: et.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{et.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDuration(et.durationMinutes)}, {LOCATION_LABELS[et.locationType]}
                  </span>
                </span>
                <ChevronRightIcon className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  )
}
