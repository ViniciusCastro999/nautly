import "dotenv/config"
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator"
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator"
import { db } from "../src/db"

async function main() {
  const migrationsFolder = "./drizzle"
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePostgres(db as any, { migrationsFolder })
  } else {
    await migratePglite(db, { migrationsFolder })
  }
  console.log("✓ Migrações aplicadas")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
