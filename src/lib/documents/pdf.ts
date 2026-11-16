/**
 * Geração dos PDFs (recibo, declaração, atestado, receituário e orçamento) com pdf-lib
 * (JavaScript puro, sem navegador headless). O conteúdo vem do payload salvo
 * na emissão, então o mesmo documento pode ser gerado de novo, idêntico.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"
import { amountInWords, formatBRL, numberInWords } from "./money"

export type Professional = {
  name: string
  registry: string | null
  taxId: string | null
  address: string | null
}
export type Patient = { name: string; document: string | null }

export type ReceiptPayload = {
  professional: Professional
  patient: Patient
  /** Linhas já formatadas no fuso do profissional. */
  items: { date: string; description: string }[]
  totalCents: number
  paymentMethod: string | null
  issuedOn: string
  issuedAtLabel: string
}

export type AttendancePayload = {
  professional: Professional
  patient: Patient
  date: string
  start: string
  end: string
  description: string
  issuedOn: string
  issuedAtLabel: string
}

export type CertificatePayload = {
  professional: Professional
  patient: Patient
  date: string
  start: string
  end: string
  /** Dias de afastamento a partir da data do atendimento (0 = só o período do atendimento). */
  days: number
  /** Só preenchido com autorização do paciente. */
  cid: string | null
  issuedOn: string
  issuedAtLabel: string
}

export type PrescriptionPayload = {
  professional: Professional
  patient: Patient
  /** "Uso interno", "Uso externo"... */
  usage: string
  items: { name: string; instructions: string }[]
  notes: string | null
  issuedOn: string
  issuedAtLabel: string
}

export type DocumentPayload =
  | ({ kind: "receipt" } & ReceiptPayload)
  | ({ kind: "attendance" } & AttendancePayload)
  | ({ kind: "certificate" } & CertificatePayload)
  | ({ kind: "prescription" } & PrescriptionPayload)

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 56
const NAVY = rgb(0.043, 0.208, 0.345)
const MUTED = rgb(0.4, 0.45, 0.52)
const PRIMARY = rgb(0, 0.42, 1)
const LINE = rgb(0.85, 0.87, 0.9)

/** Fontes padrão do PDF usam WinAnsi: remove caracteres que ela não codifica (ex.: emoji). */
const WIN_ANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"])
export function pdfSafe(text: string) {
  return [...text.normalize("NFC")]
    .filter((ch) => {
      const code = ch.codePointAt(0)!
      return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)
    })
    .join("")
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = []
  let line = ""
  for (const word of pdfSafe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

class Writer {
  y = A4.height - MARGIN
  page: PDFPage
  regular!: PDFFont
  bold!: PDFFont
  constructor(readonly pdf: PDFDocument) {
    this.page = pdf.addPage([A4.width, A4.height])
  }

  static async create(pdf: PDFDocument) {
    const w = new Writer(pdf)
    w.regular = await pdf.embedFont(StandardFonts.Helvetica)
    w.bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    return w
  }

  /** Abre uma nova página quando não há espaço para o próximo bloco. */
  ensure(space: number) {
    if (this.y - space > MARGIN + 24) return
    this.page = this.pdf.addPage([A4.width, A4.height])
    this.y = A4.height - MARGIN
  }

  /** Texto alinhado à direita na linha atual (não move o cursor). */
  right(text: string, size: number, bold: boolean, color = NAVY) {
    const font = bold ? this.bold : this.regular
    const safe = pdfSafe(text)
    this.page.drawText(safe, {
      x: A4.width - MARGIN - font.widthOfTextAtSize(safe, size),
      y: this.y - size,
      size,
      font,
      color,
    })
  }

  get width() {
    return A4.width - MARGIN * 2
  }

  text(
    text: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {},
  ) {
    const size = opts.size ?? 11
    const font = opts.bold ? this.bold : this.regular
    for (const line of wrap(text, font, size, this.width)) {
      this.ensure(size * 1.5)
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color: opts.color ?? NAVY })
      this.y -= size * 1.5
    }
    this.y -= opts.gap ?? 0
  }

  rule(gap = 16) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4.width - MARGIN, y: this.y },
      thickness: 1,
      color: LINE,
    })
    this.y -= gap
  }

  header(p: Professional) {
    this.text(p.name, { size: 16, bold: true })
    const meta = [p.registry, p.taxId && `CPF/CNPJ ${p.taxId}`].filter(Boolean).join("  ·  ")
    if (meta) this.text(meta, { size: 10, color: MUTED })
    if (p.address) this.text(p.address, { size: 10, color: MUTED })
    this.y -= 8
    this.rule(28)
  }

  signature(p: Professional, issuedOn: string) {
    this.ensure(120)
    this.y -= 8
    this.text(`${issuedOn}.`, { gap: 56 })
    const lineWidth = 240
    const x = (A4.width - lineWidth) / 2
    this.page.drawLine({
      start: { x, y: this.y },
      end: { x: x + lineWidth, y: this.y },
      thickness: 0.8,
      color: NAVY,
    })
    this.y -= 16
    this.centered(p.name, 11, true)
    if (p.registry) this.centered(p.registry, 10, false)
  }

  centered(text: string, size: number, bold: boolean) {
    const font = bold ? this.bold : this.regular
    const safe = pdfSafe(text)
    const w = font.widthOfTextAtSize(safe, size)
    this.page.drawText(safe, { x: (A4.width - w) / 2, y: this.y - size, size, font, color: NAVY })
    this.y -= size * 1.5
  }

  footer(text: string) {
    const safe = pdfSafe(text)
    const pages = this.pdf.getPages()
    pages.forEach((page, i) => {
      const label = pages.length > 1 ? `${safe}  ·  Página ${i + 1} de ${pages.length}` : safe
      page.drawText(label, { x: MARGIN, y: MARGIN / 2, size: 8, font: this.regular, color: MUTED })
    })
  }
}

function patientId(p: Patient) {
  return p.document ? `${p.name}, CPF ${p.document},` : `${p.name}`
}

export async function renderDocumentPdf(doc: DocumentPayload, number: number) {
  const pdf = await PDFDocument.create()
  const w = await Writer.create(pdf)
  const page = w.page
  const numberLabel = String(number).padStart(4, "0")

  w.header(doc.professional)

  if (doc.kind === "receipt") {
    pdf.setTitle(`Recibo ${numberLabel}`)
    const top = w.y
    w.text(`RECIBO Nº ${numberLabel}`, { size: 18, bold: true })
    // Valor em destaque à direita do título.
    const value = formatBRL(doc.totalCents)
    const vw = w.bold.widthOfTextAtSize(value, 18)
    page.drawText(pdfSafe(value), {
      x: A4.width - MARGIN - vw,
      y: top - 18,
      size: 18,
      font: w.bold,
      color: PRIMARY,
    })
    w.y -= 12

    const sessions = doc.items.length === 1 ? "no dia" : "nas datas listadas abaixo"
    w.text(
      `Recebi de ${patientId(doc.patient)} a importância de ${value} (${amountInWords(doc.totalCents)}), ` +
        `referente a ${doc.items.length} atendimento${doc.items.length > 1 ? "s" : ""} ${sessions}` +
        `${doc.items.length === 1 ? ` ${doc.items[0].date}` : ""}.`,
      { size: 12, gap: 8 },
    )
    if (doc.paymentMethod) w.text(`Forma de pagamento: ${doc.paymentMethod}.`, { size: 12, gap: 8 })

    if (doc.items.length > 1) {
      w.y -= 4
      w.rule(14)
      for (const item of doc.items) {
        page.drawText(pdfSafe(item.date), { x: MARGIN, y: w.y - 10, size: 10, font: w.bold, color: NAVY })
        page.drawText(pdfSafe(item.description), {
          x: MARGIN + 110,
          y: w.y - 10,
          size: 10,
          font: w.regular,
          color: NAVY,
        })
        w.y -= 18
      }
      w.rule(8)
    }
    w.y -= 8
    w.text("Para clareza, firmo o presente recibo.", { size: 12 })
  } else if (doc.kind === "certificate") {
    pdf.setTitle(`Atestado ${numberLabel}`)
    w.text("ATESTADO", { size: 18, bold: true, gap: 12 })
    const rest =
      doc.days > 0
        ? `, necessitando de ${doc.days} (${numberInWords(doc.days)}) dia${doc.days > 1 ? "s" : ""} de ` +
          `afastamento de suas atividades a partir desta data`
        : ", devendo ser dispensado(a) de suas atividades durante esse período"
    w.text(
      `Atesto, para os devidos fins, que ${patientId(doc.patient)} esteve sob meus cuidados profissionais ` +
        `no dia ${doc.date}, das ${doc.start} às ${doc.end}${rest}.`,
      { size: 12, gap: 8 },
    )
    if (doc.cid) w.text(`CID: ${doc.cid} (informado com autorização do paciente).`, { size: 12, gap: 8 })
  } else if (doc.kind === "prescription") {
    pdf.setTitle(`Receituário ${numberLabel}`)
    w.text("RECEITUÁRIO", { size: 18, bold: true, gap: 4 })
    w.text(`Paciente: ${patientId(doc.patient).replace(/,$/, "")}`, { size: 12, gap: 6 })
    w.text(doc.usage.toUpperCase(), { size: 11, bold: true, color: MUTED, gap: 8 })
    doc.items.forEach((item, i) => {
      w.ensure(60)
      w.text(`${i + 1}. ${item.name}`, { size: 12, bold: true })
      w.text(item.instructions, { size: 11, gap: 10 })
    })
    if (doc.notes) {
      w.rule(14)
      w.text(doc.notes, { size: 11, color: MUTED })
    }
  } else {
    pdf.setTitle(`Declaração ${numberLabel}`)
    w.text("DECLARAÇÃO DE COMPARECIMENTO", { size: 18, bold: true, gap: 12 })
    w.text(
      `Declaro, para os devidos fins, que ${patientId(doc.patient)} esteve presente em ${doc.description} ` +
        `no dia ${doc.date}, das ${doc.start} às ${doc.end}.`,
      { size: 12, gap: 8 },
    )
  }

  w.y -= 16
  w.signature(doc.professional, doc.issuedOn)
  w.footer(`Documento nº ${numberLabel} emitido em ${doc.issuedAtLabel} pelo Nautly Agendamentos.`)

  return pdf.save()
}

/* -------------------------------------------------------------------------- */
/*                         Orçamento / plano de tratamento                     */
/* -------------------------------------------------------------------------- */

export type BudgetPdf = {
  professional: Professional
  organizationName: string
  patient: Patient
  title: string
  createdOn: string
  validUntil: string | null
  items: { description: string; detail: string | null; priceCents: number }[]
  subtotalCents: number
  discountCents: number
  totalCents: number
  notes: string | null
  /** Ex.: "Aprovado por Carla Mendes em 10/11/2026 às 14:32 (IP 200.1.2.3)". */
  approval: string | null
  generatedAtLabel: string
}

export async function renderBudgetPdf(b: BudgetPdf) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Orçamento: ${pdfSafe(b.title)}`)
  const w = await Writer.create(pdf)

  w.header(b.professional)
  w.text("ORÇAMENTO", { size: 18, bold: true })
  w.text(b.title, { size: 13, gap: 4 })
  w.text(
    `Paciente: ${b.patient.name}  ·  Emitido em ${b.createdOn}${b.validUntil ? `  ·  Válido até ${b.validUntil}` : ""}`,
    { size: 10, color: MUTED, gap: 12 },
  )

  // Cabeçalho da tabela.
  w.ensure(40)
  w.page.drawText("PROCEDIMENTO", { x: MARGIN, y: w.y - 9, size: 9, font: w.bold, color: MUTED })
  w.right("VALOR", 9, true, MUTED)
  w.y -= 16
  w.rule(10)

  const descWidth = w.width - 110
  for (const item of b.items) {
    const lines = wrap(item.description, w.regular, 11, descWidth)
    const height = lines.length * 15 + (item.detail ? 13 : 0) + 8
    w.ensure(height)
    w.right(formatBRL(item.priceCents), 11, false)
    for (const line of lines) {
      w.page.drawText(line, { x: MARGIN, y: w.y - 11, size: 11, font: w.regular, color: NAVY })
      w.y -= 15
    }
    if (item.detail) {
      w.page.drawText(pdfSafe(item.detail), { x: MARGIN, y: w.y - 9, size: 9, font: w.regular, color: MUTED })
      w.y -= 13
    }
    w.y -= 8
  }
  w.rule(12)

  w.ensure(70)
  const totalLine = (label: string, value: string, bold = false, size = 11) => {
    const font = bold ? w.bold : w.regular
    const lw = font.widthOfTextAtSize(label, size)
    w.page.drawText(pdfSafe(label), {
      x: A4.width - MARGIN - 150 - lw + 40,
      y: w.y - size,
      size,
      font,
      color: NAVY,
    })
    w.right(value, size, bold, bold ? PRIMARY : NAVY)
    w.y -= size * 1.7
  }
  if (b.discountCents > 0) {
    totalLine("Subtotal", formatBRL(b.subtotalCents))
    totalLine("Desconto", `- ${formatBRL(b.discountCents)}`)
  }
  totalLine("Total", formatBRL(b.totalCents), true, 14)
  w.y -= 8

  if (b.notes) {
    w.text("Observações", { size: 11, bold: true })
    w.text(b.notes, { size: 10, gap: 8 })
  }

  w.ensure(60)
  if (b.approval) {
    w.rule(12)
    w.text("APROVAÇÃO DO PACIENTE", { size: 10, bold: true, color: MUTED })
    w.text(b.approval, { size: 11 })
  } else {
    w.y -= 40
    const lineWidth = 240
    const x = (A4.width - lineWidth) / 2
    w.page.drawLine({ start: { x, y: w.y }, end: { x: x + lineWidth, y: w.y }, thickness: 0.8, color: NAVY })
    w.y -= 16
    w.centered(`De acordo: ${b.patient.name}`, 10, false)
  }

  w.footer(`${b.organizationName}  ·  Gerado em ${b.generatedAtLabel} pelo Nautly Agendamentos.`)
  return pdf.save()
}
