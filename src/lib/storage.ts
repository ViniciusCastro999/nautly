import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { decryptBuffer, encryptBuffer } from "@/lib/crypto"

/**
 * Storage de arquivos com criptografia na aplicação. Em desenvolvimento grava
 * no disco (./.data/uploads); a interface é pequena para trocar por S3/R2
 * em produção sem mudar quem usa.
 */
export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
}

class LocalEncryptedStorage implements FileStorage {
  constructor(private root: string) {}

  private resolve(key: string) {
    const full = path.resolve(this.root, key)
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Chave de arquivo inválida")
    return full
  }

  async put(key: string, data: Buffer) {
    const file = this.resolve(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, encryptBuffer(data))
  }

  async get(key: string) {
    return decryptBuffer(await readFile(this.resolve(key)))
  }
}

export const storage: FileStorage = new LocalEncryptedStorage(process.env.UPLOADS_DIR ?? "./.data/uploads")

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "text/plain",
])
