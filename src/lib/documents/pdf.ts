/**
 * Geração dos PDFs (recibo, declaração, atestado, receituário e orçamento) com pdf-lib
 * (JavaScript puro, sem navegador headless). O conteúdo vem do payload salvo
 * na emissão, então o mesmo documento pode ser gerado de novo, idêntico.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib"
import { BRAND_MARK_PNG } from "./brand-mark"
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

/* ------------------------------- Identidade ------------------------------- */

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 56
/** Abaixo disso fica o rodapé. */
const CONTENT_BOTTOM = 66

const hex = (h: string) =>
  rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)

/** Mesma paleta do app (globals.css). */
const INK = hex("#162a4f")
const TEXT = hex("#24364f")
const MUTED = hex("#4f6478")
const PRIMARY = hex("#1b6a8a")
const LINE = hex("#d5e0e4")
const SOFT = hex("#ecf6f6")
const WHITE = rgb(1, 1, 1)
const LABEL_SPACING = 0.8

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
  for (const paragraph of pdfSafe(text.replace(/\r/g, "")).split("\n")) {
    let line = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

type TextOpts = {
  size?: number
  bold?: boolean
  color?: RGB
  /** Espaço extra depois do bloco. */
  gap?: number
  x?: number
  width?: number
  leading?: number
}

class Writer {
  y = 0
  page!: PDFPage
  regular!: PDFFont
  bold!: PDFFont
  mark!: PDFImage
  constructor(readonly pdf: PDFDocument) {}

  static async create(pdf: PDFDocument) {
    const w = new Writer(pdf)
    w.regular = await pdf.embedFont(StandardFonts.Helvetica)
    w.bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    w.mark = await pdf.embedPng(Buffer.from(BRAND_MARK_PNG, "base64"))
    w.newPage()
    return w
  }

  newPage() {
    this.page = this.pdf.addPage([A4.width, A4.height])
    // Faixa de cor no topo de todas as páginas.
    this.page.drawRectangle({ x: 0, y: A4.height - 6, width: A4.width, height: 6, color: PRIMARY })
    this.y = A4.height - MARGIN
  }

  /** Abre uma nova página quando não há espaço para o próximo bloco. */
  ensure(space: number) {
    if (this.y - space < CONTENT_BOTTOM) this.newPage()
  }

  get width() {
    return A4.width - MARGIN * 2
  }

  font(bold?: boolean) {
    return bold ? this.bold : this.regular
  }

  /** Desenha uma linha de texto com o topo em `top`. */
  draw(text: string, x: number, top: number, size: number, bold = false, color = TEXT) {
    this.page.drawText(pdfSafe(text), { x, y: top - size * 0.8, size, font: this.font(bold), color })
  }

  /** Texto alinhado à direita em `right` (não move o cursor). */
  drawRight(text: string, right: number, top: number, size: number, bold = false, color = TEXT) {
    const safe = pdfSafe(text)
    const x = right - this.font(bold).widthOfTextAtSize(safe, size)
    this.page.drawText(safe, { x, y: top - size * 0.8, size, font: this.font(bold), color })
  }

  /** Rótulo pequeno em caixa alta, com espaçamento entre letras. */
  label(text: string, x: number, top: number, color = MUTED, size = 8) {
    for (const ch of pdfSafe(text.toUpperCase())) {
      this.page.drawText(ch, { x, y: top - size * 0.8, size, font: this.bold, color })
      x += this.bold.widthOfTextAtSize(ch, size) + LABEL_SPACING
    }
  }

  labelWidth(text: string, size = 8) {
    const safe = pdfSafe(text.toUpperCase())
    return this.bold.widthOfTextAtSize(safe, size) + LABEL_SPACING * Math.max(0, safe.length - 1)
  }

  text(text: string, opts: TextOpts = {}) {
    const size = opts.size ?? 12
    const leading = opts.leading ?? size * 1.5
    const x = opts.x ?? MARGIN
    const font = this.font(opts.bold)
    for (const line of wrap(text, font, size, opts.width ?? this.width)) {
      this.ensure(leading)
      this.draw(line, x, this.y, size, opts.bold, opts.color ?? TEXT)
      this.y -= leading
    }
    this.y -= opts.gap ?? 0
  }

  /** Altura que `text` ocupará, sem desenhar. */
  measure(text: string, size: number, width: number, bold = false, leading = size * 1.5) {
    return wrap(text, this.font(bold), size, width).length * leading
  }

  rule(gap = 16, color = LINE, x = MARGIN, width = this.width) {
    this.page.drawLine({ start: { x, y: this.y }, end: { x: x + width, y: this.y }, thickness: 0.8, color })
    this.y -= gap
  }

  header(p: Professional) {
    this.text(p.name, { size: 19, bold: true, color: INK, leading: 24 })
    const meta = [p.registry, p.taxId && `CPF/CNPJ ${p.taxId}`].filter(Boolean).join("  ·  ")
    if (meta) this.text(meta, { size: 10.5, color: MUTED, leading: 15 })
    if (p.address) this.text(p.address, { size: 10.5, color: MUTED, leading: 15 })
    this.y -= 10
    this.rule(24)
  }

  /** Título do documento, com o número à direita. */
  title(kind: string, number?: string) {
    this.ensure(50)
    if (number) this.drawRight(number, MARGIN + this.width, this.y - 7, 12, true, MUTED)
    this.text(kind, { size: 24, bold: true, color: INK, leading: 30, gap: 8 })
  }

  /** Caixa com pares rótulo/valor lado a lado. */
  facts(items: { label: string; value: string; flex?: number }[]) {
    const pad = 14
    const inner = this.width - pad * 2
    const total = items.reduce((s, i) => s + (i.flex ?? 1), 0)
    const gapX = 18
    const cols = items.map((i) => ((i.flex ?? 1) / total) * (inner - gapX * (items.length - 1)))
    const heights = items.map((it, k) => this.measure(it.value, 12, cols[k], true, 16))
    const height = pad * 2 + 16 + Math.max(...heights) - 4
    this.ensure(height + 10)
    const top = this.y
    this.page.drawRectangle({ x: MARGIN, y: top - height, width: this.width, height, color: SOFT })
    let x = MARGIN + pad
    items.forEach((it, k) => {
      this.label(it.label, x, top - pad)
      wrap(it.value, this.bold, 12, cols[k]).forEach((line, n) =>
        this.draw(line, x, top - pad - 16 - n * 16, 12, true, INK),
      )
      x += cols[k] + gapX
    })
    this.y = top - height - 18
  }

  signature(p: Professional, issuedOn: string) {
    this.ensure(130)
    this.y -= 6
    this.text(`${issuedOn}.`, { size: 12, color: MUTED, gap: 58 })
    const lineWidth = 260
    const x = (A4.width - lineWidth) / 2
    this.page.drawLine({
      start: { x, y: this.y },
      end: { x: x + lineWidth, y: this.y },
      thickness: 0.8,
      color: INK,
    })
    this.y -= 10
    this.centered(p.name, 12, true, INK)
    if (p.registry) this.centered(p.registry, 10.5, false, MUTED)
  }

  centered(text: string, size: number, bold: boolean, color = TEXT) {
    const safe = pdfSafe(text)
    const w = this.font(bold).widthOfTextAtSize(safe, size)
    this.draw(safe, (A4.width - w) / 2, this.y, size, bold, color)
    this.y -= size * 1.5
  }

  footer(text: string) {
    const safe = pdfSafe(text)
    const pages = this.pdf.getPages()
    pages.forEach((page, i) => {
      page.drawLine({
        start: { x: MARGIN, y: 54 },
        end: { x: A4.width - MARGIN, y: 54 },
        thickness: 0.6,
        color: LINE,
      })
      page.drawImage(this.mark, { x: MARGIN, y: 30, width: 14, height: 14 })
      page.drawText(safe, { x: MARGIN + 20, y: 34, size: 8.5, font: this.regular, color: MUTED })
      if (pages.length > 1) {
        const label = `Página ${i + 1} de ${pages.length}`
        const lw = this.regular.widthOfTextAtSize(label, 8.5)
        page.drawText(label, {
          x: A4.width - MARGIN - lw,
          y: 34,
          size: 8.5,
          font: this.regular,
          color: MUTED,
        })
      }
    })
  }
}

function patientId(p: Patient) {
  return p.document ? `${p.name}, CPF ${p.document},` : `${p.name}`
}

export async function renderDocumentPdf(doc: DocumentPayload, number: number) {
  const pdf = await PDFDocument.create()
  const w = await Writer.create(pdf)
  const numberLabel = String(number).padStart(4, "0")
  const numbered = `Nº ${numberLabel}`

  w.header(doc.professional)

  if (doc.kind === "receipt") {
    pdf.setTitle(`Recibo ${numberLabel}`)
    w.title("RECIBO", numbered)
    const value = formatBRL(doc.totalCents)
    w.facts([
      { label: "Recebido de", value: doc.patient.name, flex: 2 },
      { label: "Valor", value },
      ...(doc.paymentMethod ? [{ label: "Pagamento", value: doc.paymentMethod }] : []),
    ])

    const sessions = doc.items.length === 1 ? "no dia" : "nas datas listadas abaixo"
    w.text(
      `Recebi de ${patientId(doc.patient)} a importância de ${value} (${amountInWords(doc.totalCents)}), ` +
        `referente a ${doc.items.length} atendimento${doc.items.length > 1 ? "s" : ""} ${sessions}` +
        `${doc.items.length === 1 ? ` ${doc.items[0].date}` : ""}.`,
      { size: 12.5, leading: 20, gap: 12 },
    )

    if (doc.items.length > 1) {
      w.ensure(40)
      w.label("Data", MARGIN, w.y)
      w.label("Atendimento", MARGIN + 110, w.y)
      w.y -= 16
      w.rule(10)
      for (const item of doc.items) {
        w.ensure(24)
        w.draw(item.date, MARGIN, w.y, 11.5, true, INK)
        w.draw(item.description, MARGIN + 110, w.y, 11.5)
        w.y -= 16
        w.rule(10)
      }
      w.y -= 6
    }
    w.text("Para clareza, firmo o presente recibo.", { size: 12.5 })
  } else if (doc.kind === "certificate") {
    pdf.setTitle(`Atestado ${numberLabel}`)
    w.title("ATESTADO", numbered)
    const rest =
      doc.days > 0
        ? `, necessitando de ${doc.days} (${numberInWords(doc.days)}) dia${doc.days > 1 ? "s" : ""} de ` +
          `afastamento de suas atividades a partir desta data`
        : ", devendo ser dispensado(a) de suas atividades durante esse período"
    w.text(
      `Atesto, para os devidos fins, que ${patientId(doc.patient)} esteve sob meus cuidados profissionais ` +
        `no dia ${doc.date}, das ${doc.start} às ${doc.end}${rest}.`,
      { size: 12.5, leading: 20, gap: 10 },
    )
    if (doc.cid)
      w.text(`CID: ${doc.cid} (informado com autorização do paciente).`, { size: 12.5, leading: 20, gap: 10 })
  } else if (doc.kind === "prescription") {
    pdf.setTitle(`Receituário ${numberLabel}`)
    w.title("RECEITUÁRIO", numbered)
    w.facts([
      { label: "Paciente", value: doc.patient.name, flex: 2 },
      ...(doc.patient.document ? [{ label: "CPF", value: doc.patient.document }] : []),
      { label: "Uso", value: doc.usage },
    ])
    doc.items.forEach((item, i) => {
      const instr = w.measure(item.instructions, 11.5, w.width - 30, false, 17)
      w.ensure(26 + instr)
      // Número em círculo à esquerda.
      w.page.drawCircle({ x: MARGIN + 10, y: w.y - 7, size: 10, color: PRIMARY })
      const n = String(i + 1)
      w.page.drawText(n, {
        x: MARGIN + 10 - w.bold.widthOfTextAtSize(n, 10) / 2,
        y: w.y - 10.5,
        size: 10,
        font: w.bold,
        color: WHITE,
      })
      w.text(item.name, {
        size: 13,
        bold: true,
        color: INK,
        x: MARGIN + 30,
        width: w.width - 30,
        leading: 19,
      })
      w.text(item.instructions, { size: 11.5, x: MARGIN + 30, width: w.width - 30, leading: 17, gap: 6 })
      w.y -= 4
      w.rule(16)
    })
    if (doc.notes) {
      w.ensure(40)
      w.label("Observações", MARGIN, w.y)
      w.y -= 16
      w.text(doc.notes, { size: 11.5, leading: 17 })
    }
  } else {
    pdf.setTitle(`Declaração ${numberLabel}`)
    w.title("DECLARAÇÃO DE COMPARECIMENTO", numbered)
    w.text(
      `Declaro, para os devidos fins, que ${patientId(doc.patient)} esteve presente em ${doc.description} ` +
        `no dia ${doc.date}, das ${doc.start} às ${doc.end}.`,
      { size: 12.5, leading: 20, gap: 10 },
    )
  }

  w.y -= 18
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
  const right = MARGIN + w.width

  w.header(b.professional)
  w.title("ORÇAMENTO")
  w.y += 6
  w.text(b.title, { size: 15, color: PRIMARY, bold: true, leading: 20, gap: 14 })
  w.facts([
    { label: "Paciente", value: b.patient.name, flex: 2 },
    { label: "Emitido em", value: b.createdOn },
    { label: "Válido até", value: b.validUntil ?? "Sem prazo" },
  ])

  // Tabela de procedimentos.
  const pad = 12
  const priceCol = 110
  const descWidth = w.width - priceCol - pad * 2
  const tableHeader = () => {
    w.ensure(60)
    const top = w.y
    w.page.drawRectangle({ x: MARGIN, y: top - 26, width: w.width, height: 26, color: INK })
    w.label("Procedimento", MARGIN + pad, top - 9.5, WHITE, 8.5)
    w.label("Valor", right - pad - w.labelWidth("Valor", 8.5), top - 9.5, WHITE, 8.5)
    w.y = top - 26
  }
  tableHeader()

  b.items.forEach((item, i) => {
    const lines = wrap(item.description, w.regular, 12, descWidth)
    const detail = item.detail ? wrap(item.detail, w.regular, 10, descWidth) : []
    const height = 10 + lines.length * 17 + detail.length * 14 + 6
    if (w.y - height < CONTENT_BOTTOM) {
      w.newPage()
      tableHeader()
    }
    const top = w.y
    if (i % 2 === 1)
      w.page.drawRectangle({ x: MARGIN, y: top - height, width: w.width, height, color: SOFT, opacity: 0.6 })
    let y = top - 10
    w.drawRight(formatBRL(item.priceCents), right - pad, y, 12, true, INK)
    for (const line of lines) {
      w.draw(line, MARGIN + pad, y, 12, false, INK)
      y -= 17
    }
    for (const line of detail) {
      w.draw(line, MARGIN + pad, y, 10, false, MUTED)
      y -= 14
    }
    w.y = top - height
    w.rule(0)
  })
  w.y -= 14

  // Totais em caixa à direita.
  const boxWidth = 240
  const boxX = right - boxWidth
  const rows = b.discountCents > 0 ? 2 : 0
  w.ensure(rows * 22 + 50)
  if (b.discountCents > 0) {
    for (const [label, value] of [
      ["Subtotal", formatBRL(b.subtotalCents)],
      ["Desconto", `- ${formatBRL(b.discountCents)}`],
    ]) {
      w.draw(label, boxX + 14, w.y, 11.5, false, MUTED)
      w.drawRight(value, right - 14, w.y, 11.5, false, TEXT)
      w.y -= 20
    }
  }
  const totalTop = w.y
  w.page.drawRectangle({ x: boxX, y: totalTop - 40, width: boxWidth, height: 40, color: PRIMARY })
  w.label("Total", boxX + 14, totalTop - 16, WHITE, 9)
  w.drawRight(formatBRL(b.totalCents), right - 14, totalTop - 12, 17, true, WHITE)
  w.y = totalTop - 40 - 20

  if (b.notes) {
    w.ensure(50)
    w.label("Observações", MARGIN, w.y)
    w.y -= 16
    w.text(b.notes, { size: 11.5, leading: 17, gap: 10 })
  }

  if (b.approval) {
    const textWidth = w.width - 40
    const height = 24 + 14 + w.measure(b.approval, 11.5, textWidth, false, 17)
    w.ensure(height + 10)
    const top = w.y
    w.page.drawRectangle({ x: MARGIN, y: top - height, width: w.width, height, color: SOFT })
    w.page.drawRectangle({ x: MARGIN, y: top - height, width: 4, height, color: PRIMARY })
    w.label("Aprovado pelo paciente", MARGIN + 20, top - 14, PRIMARY)
    w.y = top - 32
    w.text(b.approval, { size: 11.5, x: MARGIN + 20, width: textWidth, leading: 17 })
    w.y = top - height - 10
  } else {
    w.ensure(90)
    w.y -= 50
    const lineWidth = 260
    const x = (A4.width - lineWidth) / 2
    w.page.drawLine({ start: { x, y: w.y }, end: { x: x + lineWidth, y: w.y }, thickness: 0.8, color: INK })
    w.y -= 10
    w.centered(`De acordo: ${b.patient.name}`, 11, false, MUTED)
  }

  w.footer(`${b.organizationName}  ·  Gerado em ${b.generatedAtLabel} pelo Nautly Agendamentos.`)
  return pdf.save()
}
