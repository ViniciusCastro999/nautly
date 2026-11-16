import "server-only"
import { db, schema } from "@/db"

type AccessAction = (typeof schema.accessAction.enumValues)[number]

/** Registra acesso a dado sensível (LGPD). Falhas de log não quebram a requisição. */
export async function logAccess(input: {
  organizationId: string
  /** Nulo quando a ação vem do próprio paciente (link público). */
  userId: string | null
  contactId: string
  action: AccessAction
  targetId?: string
}) {
  try {
    await db.insert(schema.accessLog).values(input)
  } catch (err) {
    console.error("Falha ao registrar acesso", err)
  }
}

export const ACCESS_ACTION_LABELS: Record<AccessAction, string> = {
  record_viewed: "Visualizou o prontuário",
  note_created: "Criou um registro no prontuário",
  note_updated: "Editou um registro do prontuário",
  attachment_uploaded: "Anexou um arquivo",
  attachment_downloaded: "Abriu um anexo",
  anamnesis_viewed: "Visualizou uma anamnese",
  anamnesis_filled: "Preencheu uma anamnese",
  measurement_created: "Registrou uma avaliação",
  document_issued: "Emitiu um documento",
  odontogram_updated: "Atualizou o odontograma",
  treatment_plan_updated: "Alterou um plano de tratamento",
  treatment_plan_approved: "Aprovou um orçamento",
}
