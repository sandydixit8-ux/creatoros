import { DatabaseSync } from "node:sqlite";
import { migrate } from "../src/lib/db/db";

/**
 * Pre-deploy migration check: opens a copy of a database, applies any pending
 * migrations, and prints what it found. Run against a copy, never the live file.
 *
 *   npx tsx scripts/check-migrations.ts path/to/copy.db
 */
const path = process.argv[2];
if (!path) {
  console.error("usage: tsx scripts/check-migrations.ts <path-to-db-copy>");
  process.exit(1);
}

const db = new DatabaseSync(path);
const before = db
  .prepare("SELECT id FROM _migrations ORDER BY id")
  .all()
  .map((r) => (r as { id: number }).id);

migrate(db);

const after = db
  .prepare("SELECT id FROM _migrations ORDER BY id")
  .all()
  .map((r) => (r as { id: number }).id);
const applied = after.filter((id) => !before.includes(id));

console.log("before: " + (before.join(",") || "(none)"));
console.log("after:  " + (after.join(",") || "(none)"));
console.log("newly applied: " + (applied.join(",") || "(none)"));

if (applied.length > 0) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name);
  console.log("tables: " + tables.length);
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='refunds'").get();
  console.log("refunds table: " + (t ? "present" : "MISSING"));
  const idx = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_refunds_one_pending'")
    .get();
  console.log("one-pending index: " + (idx ? "present" : "MISSING"));

  const funnel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='funnel_events'").get();
  console.log("funnel_events table: " + (funnel ? "present" : "MISSING"));
  for (const name of ["idx_funnel_step_time", "idx_funnel_tenant"]) {
    const i = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name);
    console.log(name + ": " + (i ? "present" : "MISSING"));
  }
}
db.close();