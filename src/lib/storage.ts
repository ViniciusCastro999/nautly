import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { get, put } from "@vercel/blob"
import { decryptBuffer, encryptBuffer } from "@/lib/crypto"

/**
 * Storage de arquivos com criptografia na aplicação. Em desenvolvimento grava
 * no disco (./.data/uploads); em produção usa o Vercel Blob. Os dois guardam
 * só o conteúdo já criptografado, e quem usa não sabe qual está ativo.
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

/**
 * Vercel Blob em modo privado. Na Vercel a autenticação é automática (OIDC +
 * BLOB_STORE_ID); fora dela, usa BLOB_READ_WRITE_TOKEN.
 */
class BlobEncryptedStorage implements FileStorage {
  async put(key: string, data: Buffer) {
    await put(key, encryptBuffer(data), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/octet-stream",
    })
  }

  async get(key: string) {
    const res = await get(key, { access: "private", useCache: false })
    if (!res || res.statusCode !== 200) throw new Error("Arquivo não encontrado")
    return decryptBuffer(Buffer.from(await new Response(res.stream).arrayBuffer()))
  }
}

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)

export const storage: FileStorage = useBlob
  ? new BlobEncryptedStorage()
  : new LocalEncryptedStorage(process.env.UPLOADS_DIR ?? "./.data/uploads")

/** 4 MB: a Vercel limita o corpo da requisição de uma função a 4,5 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "text/plain",
])
