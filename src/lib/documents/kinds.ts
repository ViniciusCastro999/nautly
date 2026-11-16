/** Tipos de documento emitidos pela ficha e onde cada um aparece. */
export type DocumentKind = "receipt" | "attendance" | "certificate" | "prescription"

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  receipt: "Recibo",
  attendance: "Declaração de comparecimento",
  certificate: "Atestado",
  prescription: "Receituário",
}

/** Atestado e receituário: só áreas cujo conselho permite emitir (CRM, CRO). */
export const CLINICAL_DOC_VERTICALS = ["medicine", "dentistry"] as const

export function canIssueClinicalDocs(verticalId: string) {
  return (CLINICAL_DOC_VERTICALS as readonly string[]).includes(verticalId)
}

export const PRESCRIPTION_USAGES = ["Uso interno", "Uso externo", "Uso tópico", "Uso oral"] as const

export const DOCUMENT_FILE_NAMES: Record<DocumentKind, string> = {
  receipt: "recibo",
  attendance: "declaracao",
  certificate: "atestado",
  prescription: "receita",
}
