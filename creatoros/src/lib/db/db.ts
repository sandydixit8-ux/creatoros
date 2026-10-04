import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const path = process.env.CREATOROS_DB_PATH || process.env.DATABASE_PATH || "data/creatoros.db";
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  _db = db;
  return db;
}

export function migrate(db: DatabaseSync) {
  const schema = readFileSync(join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf8");
  db.exec(schema);
  runMigrations(db);
}

/** Ordered, idempotent migrations for database files created before a schema change. */
const MIGRATIONS: Array<{ id: number; up: (db: DatabaseSync) => void }> = [
  {
    id: 1,
    up: (db) => addColumn(db, "email_campaigns", "template_id", "TEXT REFERENCES email_templates(id) ON DELETE SET NULL"),
  },
  {
    id: 2,
    up: (db) => addColumn(db, "email_campaigns", "from_name", "TEXT NOT NULL DEFAULT ''"),
  },
  {
    id: 3,
    up: (db) => addColumn(db, "email_campaigns", "sent_at", "TEXT"),
  },
  {
    id: 4,
    up: (db) => addColumn(db, "email_campaigns", "stats", "TEXT NOT NULL DEFAULT '{}'"),
  },
  {
    id: 5,
    up: (db) => addColumn(db, "payments", "order_id", "TEXT DEFAULT ''"),
  },
  {
    id: 6,
    up: (db) => addColumn(db, "orders", "course_id", "TEXT DEFAULT ''"),
  },
  {
    id: 7,
    up: (db) => addColumn(db, "subscriptions", "customer_id", "TEXT"),
  },
  {
    // Lets admins do repeated partial refunds without over-refunding the order.
    id: 8,
    up: (db) => addColumn(db, "orders", "refunded_cents", "INTEGER NOT NULL DEFAULT 0"),
  },
  {
    // Password reset links are single-use and stored hashed.
    id: 9,
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL UNIQUE,
        expires_at  TEXT NOT NULL,
        used_at     TEXT,
        created_at  TEXT NOT NULL
      )`);
      db.exec("CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)");
    },
  },
  {
    // Consent provenance: a controller must be able to prove when and where a
    // contact opted in. Absent these, `consent` alone is unverifiable.
    id: 10,
    up: (db) => addColumn(db, "contacts", "consent_at", "TEXT"),
  },
  {
    id: 11,
    up: (db) => addColumn(db, "contacts", "consent_source", "TEXT NOT NULL DEFAULT ''"),
  },
  {
    // Remediation for the consent defect: purchases and free enrolments used to
    // write consent = 1, silently subscribing every buyer to the creator's
    // marketing campaigns. Transactional contacts are identifiable by source and
    // carry no consent_at, because no opt-in was ever captured for them. Genuine
    // opt-ins are left alone: they either have consent_at set or a non-
    // transactional source.
    id: 12,
    up: (db) => {
      db.exec(
        `UPDATE contacts
            SET consent = 0, consent_source = 'revoked_transactional'
          WHERE consent = 1
            AND consent_at IS NULL
            AND source IN ('store', 'course')`
      );
    },
  },
];

function addColumn(db: DatabaseSync, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function runMigrations(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(
    (db.prepare("SELECT id FROM _migrations").all() as unknown as { id: number }[]).map((r) => r.id)
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      m.up(db);
      db.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run(m.id, new Date().toISOString());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

export type Row = Record<string, unknown>;

export type SQLParam = string | number | bigint | null | Uint8Array;

export function all<T = Row>(sql: string, ...params: SQLParam[]): T[] {
  return getDb()
    .prepare(sql)
    .all(...params)
    .map((r) => toPlain(r)) as unknown as T[];
}

export function row<T = Row>(sql: string, ...params: SQLParam[]): T | undefined {
  const r = getDb().prepare(sql).get(...params);
  return (r === undefined ? r : toPlain(r)) as unknown as T | undefined;
}

/** node:sqlite returns null-prototype objects; convert to plain objects so they can cross the RSC boundary. */
function toPlain<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => toPlain(x)) as unknown as T;
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    return { ...(v as Record<string, unknown>) } as T;
  }
  return v;
}

export function run(sql: string, ...params: SQLParam[]): { changes: number; lastInsertRowid: number | bigint } {
  const stmt = getDb().prepare(sql);
  const info = stmt.run(...params);
  return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
}

export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nanoid(size = 12): string {
  return randomBytes(size).toString("base64url").slice(0, size);
}

export function closeDb() {
  _db?.close();
  _db = null;
}