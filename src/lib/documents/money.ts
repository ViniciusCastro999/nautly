/** Valores em reais: formatação e valor por extenso (usado nos recibos). */

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** "400,00", "1.250,5", "R$ 80" → centavos. Inválido → null. */
export function parseBRL(input: string): number | null {
  const clean = input.replace(/[R$\s]/g, "")
  if (!/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$/.test(clean)) return null
  const [int, dec = ""] = clean.replace(/\./g, "").split(",")
  return Number(int) * 100 + Number(dec.padEnd(2, "0"))
}

const UNITS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
]
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
]

/** 0 a 999 por extenso. */
function upTo999(n: number): string {
  if (n === 100) return "cem"
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(HUNDREDS[h])
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest])
    else {
      const t = Math.floor(rest / 10)
      const u = rest % 10
      parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t])
    }
  }
  return parts.join(" e ") || UNITS[0]
}

/** 0 a 999.999 por extenso. */
export function numberInWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) throw new RangeError("Fora do intervalo suportado")
  if (n < 1000) return upTo999(n)
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  const head = thousands === 1 ? "mil" : `${upTo999(thousands)} mil`
  if (!rest) return head
  // "mil e cinquenta", "mil e duzentos", mas "mil duzentos e cinquenta".
  const joiner = rest < 100 || rest % 100 === 0 ? " e " : " "
  return head + joiner + upTo999(rest)
}

/** 40000 → "quatrocentos reais"; 150 → "um real e cinquenta centavos". */
export function amountInWords(cents: number): string {
  const reais = Math.floor(cents / 100)
  const centavos = cents % 100
  const parts: string[] = []
  if (reais) parts.push(`${numberInWords(reais)} ${reais === 1 ? "real" : "reais"}`)
  if (centavos) parts.push(`${numberInWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`)
  return parts.join(" e ") || "zero real"
}
