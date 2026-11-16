import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * Criptografia de dados sensíveis em repouso (AES-256-GCM). Usada no texto do
 * prontuário e nos arquivos anexados. A chave vem de DATA_ENCRYPTION_KEY
 * (32 bytes em base64) e nunca é gravada no banco.
 */
const VERSION = "v1"

function key() {
  const raw = process.env.DATA_ENCRYPTION_KEY
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY não definida")
  const buf = Buffer.from(raw, "base64")
  if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY deve ter 32 bytes em base64")
  return buf
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain), cipher.final()])
  // Formato: iv (12) | tag (16) | dados
  return Buffer.concat([iv, cipher.getAuthTag(), data])
}

export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, 12)
  const tag = payload.subarray(12, 28)
  const data = payload.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

export function encryptText(plain: string): string {
  return `${VERSION}:${encryptBuffer(Buffer.from(plain, "utf8")).toString("base64")}`
}

export function decryptText(value: string): string {
  const [version, payload] = value.split(":", 2)
  if (version !== VERSION || !payload) throw new Error("Formato de dado criptografado inválido")
  return decryptBuffer(Buffer.from(payload, "base64")).toString("utf8")
}
