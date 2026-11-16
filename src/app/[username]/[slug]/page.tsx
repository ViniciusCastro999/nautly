import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BookingWidget } from "@/components/booking/booking-widget-loader"
import { PublicShell } from "@/components/booking/public-shell"
import { findPublicEventType } from "@/lib/scheduling/service"

export async function generateMetadata({ params }: PageProps<"/[username]/[slug]">): Promise<Metadata> {
  const { username, slug } = await params
  const data = await findPublicEventType(username, slug)
  return data ? { title: `${data.eventType.title} com ${data.host.name}` } : {}
}

export default async function PublicEventPage({ params }: PageProps<"/[username]/[slug]">) {
  const { username, slug } = await params
  const data = await findPublicEventType(username, slug)
  if (!data) notFound()
  const { host, eventType } = data

  return (
    <PublicShell>
      <BookingWidget
        host={{ name: host.name }}
        eventType={{
          id: eventType.id,
          title: eventType.title,
          description: eventType.description,
          durationMinutes: eventType.durationMinutes,
          locationType: eventType.locationType,
          locationDetail: eventType.locationDetail,
          color: eventType.color,
        }}
      />
    </PublicShell>
  )
}
