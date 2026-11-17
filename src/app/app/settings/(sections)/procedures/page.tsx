import { redirect } from "next/navigation"

/** Endereço antigo: os procedimentos agora têm seção própria no menu. */
export default function ProceduresSettingsRedirect() {
  redirect("/app/procedures")
}
