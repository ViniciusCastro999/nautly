import "dotenv/config"
import { del } from "@vercel/blob"
import { storage } from "../src/lib/storage"

async function main() {
  const key = `healthcheck/${crypto.randomUUID()}`
  const original = Buffer.from("Nautly: teste de armazenamento " + new Date().toISOString())
  await storage.put(key, original)
  const back = await storage.get(key)
  console.log(back.equals(original) ? "✓ gravou e leu o mesmo conteúdo" : "✗ conteúdo diferente")
  await del(key)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
