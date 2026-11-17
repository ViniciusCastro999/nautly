import { redirect } from "next/navigation"

/** Endereço antigo: a disponibilidade agora fica em Configurações. */
export default function AvailabilityRedirect() {
  redirect("/app/settings/availability")
}
