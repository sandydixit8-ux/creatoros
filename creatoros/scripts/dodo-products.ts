#!/usr/bin/env node
/**
 * Create the Dodo (MoR) subscription products for the paid plans.
 *
 * Dodo has no inline pricing: every checkout references a product that already
 * exists in the dashboard, so each paid plan needs an id in
 * `DODO_PRODUCT_<PLAN>`. This creates them (idempotent, matched by name) from
 * PLAN_META so the dashboard price cannot drift from src/lib/plans-meta.ts.
 *
 * Usage (reads .env.local then .env, else the process env):
 *   npx tsx scripts/dodo-products.ts            # create against DODO_ENV
 *   npx tsx scripts/dodo-products.ts --dry      # preview, no writes
 *
 * Products are USD, monthly recurring, with a 20-year subscription period:
 * Dodo expires a subscription whose period equals the billing frequency, so the
 * period must be far longer than the monthly charge.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PLAN_META } from "../src/lib/plans-meta";

function loadFile(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadFile(path.join(process.cwd(), ".env.local"));
loadFile(path.join(process.cwd(), ".env"));

const KEY = process.env.DODO_PAYMENTS_API_KEY || "";
const ENV = (process.env.DODO_ENV || "test").toLowerCase() === "live" ? "live" : "test";
const BASE = ENV === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
const CURRENCY = (process.env.DODO_PRODUCT_CURRENCY || "USD").toUpperCase();
const DRY = process.argv.includes("--dry");

if (!KEY) {
  console.error("Missing DODO_PAYMENTS_API_KEY. Put it in .env.local or the environment.");
  process.exit(1);
}

interface Product {
  product_id: string;
  name: string;
}

async function api(method: "GET" | "POST", p: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(BASE + p, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text.slice(0, 200) };
  }
  if (!res.ok) {
    const d = data as { error?: string | { message?: string }; detail?: string; message?: string };
    const reason =
      (typeof d.error === "string" ? d.error : d.error?.message) || d.detail || d.message || `HTTP ${res.status}`;
    throw new Error(`Dodo ${method} ${p} failed (${res.status}): ${reason}`);
  }
  return data as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log(`Dodo env: ${ENV} (${BASE}) · currency ${CURRENCY}${DRY ? " · DRY RUN" : ""}\n`);

  const list = (await api("GET", "/products?page_size=100")).items as Product[] | undefined;
  const byName = new Map((list || []).map((p) => [p.name, p.product_id]));
  const out: string[] = [];

  for (const plan of PLAN_META.filter((p) => p.usd > 0)) {
    const name = `CreatorOS ${plan.name}`;
    const found = byName.get(name);
    if (found) {
      console.log(`  = ${name.padEnd(22)} exists   ${found}`);
      out.push(`DODO_PRODUCT_${plan.id.toUpperCase()}=${found}`);
      continue;
    }
    if (DRY) {
      console.log(`  + ${name.padEnd(22)} create   ${CURRENCY} ${plan.usd}/mo`);
      out.push(`DODO_PRODUCT_${plan.id.toUpperCase()}=pdt_<new>`);
      continue;
    }
    const created = await api("POST", "/products", {
      name,
      description: `CreatorOS ${plan.name} plan — ${CURRENCY} ${plan.usd}/month, billed monthly via Dodo.`,
      tax_category: "saas",
      price: {
        type: "recurring_price",
        currency: CURRENCY,
        price: plan.usd * 100,
        discount: 0,
        purchasing_power_parity: false,
        payment_frequency_interval: "Month",
        payment_frequency_count: 1,
        subscription_period_interval: "Year",
        subscription_period_count: 20,
      },
      metadata: { plan: plan.id },
    });
    const id = String(created.product_id || "");
    if (!id) throw new Error(`Dodo did not return a product_id for ${name}`);
    console.log(`  + ${name.padEnd(22)} created  ${id}  (${CURRENCY} ${plan.usd}/mo)`);
    out.push(`DODO_PRODUCT_${plan.id.toUpperCase()}=${id}`);
  }

  console.log("\n# Add to the app environment (.env / server):\n" + out.join("\n"));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
