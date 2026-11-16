import { mkdirSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/**
 * Em desenvolvimento, sem DATABASE_URL, usamos PGlite (Postgres compilado
 * para WASM, persistido em ./.data/pglite): zero setup, sem Docker.
 * Em produção, defina DATABASE_URL para um Postgres real (Neon, Supabase…).
 * O schema é o mesmo nos dois casos.
 */
function createDb() {
  const url = process.env.DATABASE_URL
  if (url) {
    return drizzlePostgres(postgres(url, { prepare: false }), { schema }) as unknown as ReturnType<
      typeof createPgliteDb
    >
  }
  return createPgliteDb()
}

function createPgliteDb() {
  const dir = process.env.PGLITE_DIR ?? "./.data/pglite"
  mkdirSync(dir, { recursive: true })
  const client = new PGlite(dir)
  return drizzlePglite({ client, schema })
}

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof createDb> }

function getDb() {
  globalForDb.__db ??= createDb()
  return globalForDb.__db
}

/**
 * Conexão preguiçosa: só abre o banco no primeiro uso. Assim o build do Next
 * (que importa os módulos em vários workers) não abre o PGlite à toa.
 */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const real = getDb()
    const value = Reflect.get(real, prop, real)
    return typeof value === "function" ? value.bind(real) : value
  },
})

export type DB = ReturnType<typeof createDb>
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0]
export { schema }
