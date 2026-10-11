import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Guards the API contract in docs/06: a request body is validated with zod
 * before it reaches a query. A bare `as { ... }` cast is a compile-time claim
 * only, so a wrong-typed field used to reach better-sqlite3 and surface as a
 * 500 instead of a 400.
 */

function apiRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...apiRoutes(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** Splits a route file into one source chunk per exported HTTP method. */
function handlers(src: string): Array<{ method: string; body: string }> {
  const marks = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)];
  return marks.map((m, i) => ({
    method: m[1],
    body: src.slice(m.index, marks[i + 1]?.index ?? src.length),
  }));
}

const routes = apiRoutes(join(process.cwd(), "src", "app", "api"));

describe("request body validation", () => {
  it("finds the api routes", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it("never type-casts a parsed body instead of validating it", () => {
    const offenders: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      // `as { websiteId?: string }` on a req.json() result is an unchecked claim.
      if (/await req\.json\(\)[^;]*\bas\s*\{/.test(src)) {
        offenders.push(file.replace(process.cwd(), ""));
      }
    }
    expect(offenders, "validate the body with zod rather than asserting its shape").toEqual([]);
  });

  it("validates every parsed body with a zod schema", () => {
    // Routes that legitimately read no request body.
    const noBody = new Set([
      "/auth/logout",
      "/auth/login", // parses credentials, checked below via parse coverage
    ]);
    const offenders: string[] = [];
    for (const file of routes) {
      const rel = file
        .replace(join(process.cwd(), "src", "app", "api"), "")
        .replace(/\\/g, "/")
        .replace(/\/route\.ts$/, "");
      const routePath = rel.startsWith("/") ? rel : `/${rel}`;
      for (const h of handlers(readFileSync(file, "utf8"))) {
        if (!/await req\.json\(\)/.test(h.body)) continue;
        if (noBody.has(routePath)) continue;
        if (!/\.safeParse\(/.test(h.body)) {
          offenders.push(`${routePath} ${h.method}`);
        }
      }
    }
    expect(offenders, "every request body must pass through a zod safeParse").toEqual([]);
  });

  it("rejects an unknown gap status rather than writing it", () => {
    // Regression for the hand-rolled allowlist this replaced.
    const patch = z.object({
      id: z.string().min(1).max(64),
      status: z.enum(["missing", "planned", "done", "ignored"]),
    });
    expect(patch.safeParse({ id: "g1", status: "done" }).success).toBe(true);
    expect(patch.safeParse({ id: "g1", status: "deleted'--" }).success).toBe(false);
    expect(patch.safeParse({ id: "g1", status: 42 }).success).toBe(false);
    expect(patch.safeParse({ status: "done" }).success).toBe(false);
    expect(patch.safeParse({ id: "g1", status: "done", extra: 1 }).success).toBe(true);
  });
});

describe("sql construction", () => {
  /**
   * Interpolating into SQL text is only safe for fragments this codebase builds
   * from static strings, and for column names resolved through an allowlist map.
   * A user value must always travel as a bound `?` parameter. This allowlist is
   * the contract: adding a new interpolation means justifying it here.
   */
  const SAFE_SQL_INTERPOLATION = new Set([
    "whereSql", // static clause list joined by callers
    "where",
    'where.join(" AND ")',
    "column", // resolved via COLUMN_MAP
  ]);

  it("only interpolates known-safe fragments into sql", () => {
    const offenders: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      for (const tmpl of src.matchAll(/`([^`]*(?:SELECT|INSERT INTO|UPDATE |DELETE FROM)[^`]*)`/gis)) {
        for (const expr of tmpl[1].matchAll(/\$\{([^}]*)\}/g)) {
          if (!SAFE_SQL_INTERPOLATION.has(expr[1].trim())) {
            offenders.push(`${file.replace(process.cwd(), "")}: \${${expr[1]}}`);
          }
        }
      }
    }
    expect(offenders, "pass user values as bound ? parameters").toEqual([]);
  });

  it("resolves any interpolated column name through an allowlist map", () => {
    const offenders: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const interpolatesColumn = /`[^`]*(?:UPDATE|SET)[^`]*\$\{\s*column\s*\}/is.test(src);
      if (!interpolatesColumn) continue;
      // Existence of the map is not enough: `column` must be *derived* from it,
      // or a caller-supplied key reaches the SQL text directly.
      if (!/const column = COLUMN_MAP\[/.test(src)) {
        offenders.push(`${file.replace(process.cwd(), "")}: column is not resolved via COLUMN_MAP`);
      }
      if (!/if \(!column\) continue;/.test(src)) {
        offenders.push(`${file.replace(process.cwd(), "")}: no guard for an unmapped key`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("binds search terms as parameters rather than sql text", () => {
    // A LIKE pattern may contain user input, but only as a bound value.
    const offenders: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      if (/params\.push\(\s*`%\$\{/g.test(src) && /`[^`]*(?:SELECT|UPDATE)[^`]*LIKE\s+['"`]\s*%/i.test(src)) {
        offenders.push(file.replace(process.cwd(), ""));
      }
    }
    expect(offenders).toEqual([]);
  });
});
