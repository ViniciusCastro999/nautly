import { test } from "node:test"
import assert from "node:assert/strict"
import { pdfSafe, renderBudgetPdf, renderDocumentPdf } from "./pdf"

const professional = {
  name: "Dra. Ana Souza",
  registry: "CRN-3 12345",
  taxId: "123.456.789-00",
  address: null,
}

test("remove caracteres fora do WinAnsi e mantém acentos", () => {
  assert.equal(pdfSafe("Sessão nº 3 – ok 🎉"), "Sessão nº 3 – ok ")
})

test("gera PDFs válidos de recibo e declaração", async () => {
  const receipt = await renderDocumentPdf(
    {
      kind: "receipt",
      professional,
      patient: { name: "Carla Mendes 😀", document: "123.456.789-00" },
      items: [
        { date: "06/11/2026", description: "Consulta inicial" },
        { date: "19/11/2026", description: "Retorno" },
      ],
      totalCents: 55_000,
      paymentMethod: "Pix",
      issuedOn: "16 de novembro de 2026",
      issuedAtLabel: "16/11/2026 10:00",
    },
    1,
  )
  assert.equal(Buffer.from(receipt.slice(0, 5)).toString(), "%PDF-")

  const declaration = await renderDocumentPdf(
    {
      kind: "attendance",
      professional,
      patient: { name: "Carla Mendes", document: null },
      date: "06/11/2026",
      start: "09:00",
      end: "10:00",
      description: "consulta",
      issuedOn: "16 de novembro de 2026",
      issuedAtLabel: "16/11/2026 10:00",
    },
    2,
  )
  assert.ok(declaration.length > 500)
})

test("gera atestado, receituário e orçamento com várias páginas", async () => {
  const issued = { issuedOn: "16 de novembro de 2026", issuedAtLabel: "16/11/2026 10:00" }
  const certificate = await renderDocumentPdf(
    {
      kind: "certificate",
      professional,
      patient: { name: "Carla Mendes", document: null },
      date: "16/11/2026",
      start: "09:00",
      end: "09:40",
      days: 2,
      cid: "K08.8",
      ...issued,
    },
    3,
  )
  assert.equal(Buffer.from(certificate.slice(0, 5)).toString(), "%PDF-")

  const prescription = await renderDocumentPdf(
    {
      kind: "prescription",
      professional,
      patient: { name: "Carla Mendes", document: null },
      usage: "Uso oral",
      items: [{ name: "Ibuprofeno 600 mg", instructions: "1 comprimido de 8 em 8 horas por 3 dias." }],
      notes: null,
      ...issued,
    },
    4,
  )
  assert.ok(prescription.length > 500)

  const budget = await renderBudgetPdf({
    professional,
    organizationName: "Clínica Sorriso",
    patient: { name: "Pedro Lima", document: null },
    title: "Reabilitação",
    createdOn: "16/11/2026",
    validUntil: null,
    items: Array.from({ length: 45 }, (_, i) => ({
      description: `Restauração em resina ${i + 1}`,
      detail: "Dente 36, faces MO",
      priceCents: 25_000,
    })),
    subtotalCents: 45 * 25_000,
    discountCents: 0,
    totalCents: 45 * 25_000,
    notes: "Pagamento em até 6x.",
    approval: null,
    generatedAtLabel: "16/11/2026 10:00",
  })
  const { PDFDocument } = await import("pdf-lib")
  assert.ok((await PDFDocument.load(budget)).getPageCount() >= 2)
})
