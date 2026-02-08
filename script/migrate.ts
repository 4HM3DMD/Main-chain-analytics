/**
 * Migration script — handles schema changes that drizzle-kit push can't do automatically.
 * Runs before db:push in the build pipeline.
 */
import pg from "pg";

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("No DATABASE_URL, skipping migration");
    return;
  }

  const pool = new pg.Pool({ connectionString });

  try {
    console.log("Running pre-push migrations...");

    // 1. Add chain column to snapshots if not exists
    await pool.query(`ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'mainchain'`);
    console.log("  snapshots.chain: OK");

    // 2. Drop old unique constraint that doesn't include chain
    await pool.query(`ALTER TABLE snapshots DROP CONSTRAINT IF EXISTS snapshots_date_time_slot`).catch(() => {});
    console.log("  dropped old snapshots unique constraint: OK");

    // 3. Add chain column to concentration_metrics if not exists
    await pool.query(`ALTER TABLE concentration_metrics ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'mainchain'`);
    console.log("  concentration_metrics.chain: OK");

    // 4. Create cross_chain_supply table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_supply (
        id serial PRIMARY KEY,
        date text NOT NULL,
        time_slot text NOT NULL,
        fetched_at text NOT NULL,
        mainchain_top100 real,
        esc_bridge_balance real,
        esc_total_supply real,
        esc_top100 real,
        eth_bridged_supply real,
        UNIQUE(date, time_slot)
      )
    `);
    console.log("  cross_chain_supply table: OK");

    console.log("Pre-push migrations complete!");
  } catch (error: any) {
    console.error("Migration error:", error.message);
  } finally {
    await pool.end();
  }
}

migrate();
