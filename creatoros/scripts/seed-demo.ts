#!/usr/bin/env node
import { getDb, run, newId, nowIso, all } from "../src/lib/db/db";

getDb();

// Idempotent demo store/course data for the demo-creator tenant.
// Run after npm run db:seed. Safe to re-run.

const org = all<{ id: string }>("SELECT id FROM organizations WHERE slug = 'demo-creator'");
if (org.length === 0) {
  console.log("demo-creator tenant not found. Run `npm run db:seed` first.");
  process.exit(0);
}
const tenant = org[0].id;

const page = all<{ id: string }>("SELECT id FROM bio_pages WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1", tenant);
const pageId = page.length > 0 ? page[0].id : null;
const profile = all<{ id: string }>("SELECT id FROM profiles WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1", tenant);
const profileId = profile.length > 0 ? profile[0].id : null;

const existingProducts = all<{ name: string }>("SELECT name FROM products WHERE tenant_id = ?", tenant).map((r) => r.name);

function ensureProduct(name: string, description: string, priceCents: number, kind = "digital") {
  if (existingProducts.includes(name)) return;
  run(
    "INSERT INTO products (id, tenant_id, page_id, name, description, price_cents, currency, kind, media_url, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'usd', ?, '', 1, ?, ?)",
    newId("prd"),
    tenant,
    pageId,
    name,
    description,
    priceCents,
    kind,
    nowIso(),
    nowIso()
  );
  console.log(`Seeded product: ${name}`);
}

ensureProduct(
  "The Creator Launch Kit",
  "Cheatsheets, calendars and checklists to set up your monetization stack in one sitting.",
  1900
);
ensureProduct(
  "Captions That Convert: 50 Swipe-able Hooks",
  "A swipe file of hooks and caption formulas that have driven clicks to bio links.",
  900
);

const existingCourses = all<{ title: string }>("SELECT title FROM courses WHERE tenant_id = ?", tenant).map((r) => r.title);

if (!existingCourses.includes("Monetize Your Audience in 30 Days")) {
  const courseId = newId("crs");
  const sectionId = newId("sec");
  run(
    "INSERT INTO courses (id, tenant_id, profile_id, slug, title, description, price_cents, currency, published, created_at, updated_at) VALUES (?, ?, ?, 'monetize-in-30-days', ?, ?, 4900, 'usd', 1, ?, ?)",
    courseId,
    tenant,
    profileId,
    "Monetize Your Audience in 30 Days",
    "A practical month-by-month plan to turn followers into paying customers.",
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO course_sections (id, tenant_id, course_id, title, position, created_at) VALUES (?, ?, ?, 'Foundations', 0, ?)",
    sectionId,
    tenant,
    courseId,
    nowIso()
  );
  run(
    "INSERT INTO lessons (id, tenant_id, course_id, section_id, title, type, content, duration_min, position, published, created_at, updated_at) VALUES (?, ?, ?, ?, 'Pick your first product', 'video', 'https://example.com/lesson-1', 12, 0, 1, ?, ?)",
    newId("les"),
    tenant,
    courseId,
    sectionId,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO lessons (id, tenant_id, course_id, section_id, title, type, content, duration_min, position, published, created_at, updated_at) VALUES (?, ?, ?, ?, 'Set up one-tap checkout', 'text', 'Step-by-step: create the product, pick a price, put it on your bio page.', 10, 1, 1, ?, ?)",
    newId("les"),
    tenant,
    courseId,
    sectionId,
    nowIso(),
    nowIso()
  );
  console.log("Seeded course: Monetize Your Audience in 30 Days");
}

if (pageId) {
  const blocks = all<{ type: string; position: number; payload: string }>(
    "SELECT type, position, payload FROM bio_blocks WHERE tenant_id = ? AND page_id = ? ORDER BY position ASC",
    tenant,
    pageId
  );
  const maxPos = blocks.reduce((m, b) => Math.max(m, b.position), -1);
  const hasProductBlock = blocks.some((b) => b.type === "product");
  const hasCourseLink = blocks.some((b) => b.type === "link" && String(b.payload).includes("Monetize"));
  if (!hasProductBlock) {
    run(
      "INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, created_at, updated_at) VALUES (?, ?, ?, 'product', ?, ?, ?, ?)",
      newId("blk"),
      tenant,
      pageId,
      JSON.stringify({ title: "The Creator Launch Kit", price: "19", url: "" }),
      maxPos + 1,
      nowIso(),
      nowIso()
    );
    console.log("Seeded bio product block.");
  }
  if (!hasCourseLink) {
    run(
      "INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, created_at, updated_at) VALUES (?, ?, ?, 'link', ?, ?, ?, ?)",
      newId("blk"),
      tenant,
      pageId,
      JSON.stringify({ title: "Monetize in 30 days (course)", url: "/u/democreator/courses/monetize-in-30-days" }),
      maxPos + 2,
      nowIso(),
      nowIso()
    );
    console.log("Seeded bio course link block.");
  }
}

console.log("Demo store/course seed complete.");
process.exit(0);