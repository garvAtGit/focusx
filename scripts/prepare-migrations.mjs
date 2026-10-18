import { execFileSync } from "node:child_process"
import { Pool } from "pg"

const BASELINE_MIGRATIONS = [
  "20250614000000_init",
  "20250614000001_add_indexes",
]

const CORE_TABLES = [
  "Booking",
  "CheckinLog",
  "Library",
  "Plan",
  "Query",
  "Relay",
  "Seat",
  "StandaloneLocker",
  "User",
]

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required to prepare migrations")
}

const pool = new Pool({ connectionString, max: 1 })

try {
  const { rows: tableRows } = await pool.query(
    `
      SELECT "table_name"
      FROM information_schema.tables
      WHERE "table_schema" = 'public'
        AND "table_name" = ANY($1::text[])
    `,
    [CORE_TABLES],
  )

  if (tableRows.length === 0) {
    console.log("Fresh database detected; Prisma will apply all migrations.")
  } else if (tableRows.length !== CORE_TABLES.length) {
    throw new Error(
      `Refusing to baseline a partial legacy schema: found ${tableRows.length}/${CORE_TABLES.length} core tables`,
    )
  } else {
    const { rows: historyTableRows } = await pool.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE "table_schema" = 'public'
        AND "table_name" = '_prisma_migrations'
      LIMIT 1
    `)

    let successfulMigrations = 0
    if (historyTableRows.length > 0) {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS "count"
        FROM "_prisma_migrations"
        WHERE "finished_at" IS NOT NULL
          AND "rolled_back_at" IS NULL
      `)
      successfulMigrations = rows[0]?.count ?? 0
    }

    if (successfulMigrations === 0) {
      console.log(
        "Legacy db-push schema detected; recording the original migrations as an applied baseline.",
      )
      const npx = process.platform === "win32" ? "npx.cmd" : "npx"
      for (const migration of BASELINE_MIGRATIONS) {
        execFileSync(
          npx,
          ["prisma", "migrate", "resolve", "--applied", migration],
          { stdio: "inherit", env: process.env },
        )
      }
    } else {
      console.log("Existing Prisma migration history detected; no baseline needed.")
    }
  }
} finally {
  await pool.end()
}
