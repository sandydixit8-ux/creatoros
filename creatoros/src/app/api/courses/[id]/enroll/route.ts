import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { row, run, newId, nowIso } from "@/lib/db/db";
import { getCourse, ensureEnrollment } from "@/lib/courses/engine";
import { getLimits } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(120).default(""),
  visitorId: z.string().default(""),
});

/** Free course enrollment (paid courses use /checkout). Public, rate-limited. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("course_enroll", ip), 20);
  if (!rl.allowed) return err.rateLimited();

  const { id } = await params;
  const course = getCourse(id);
  if (!course || course.published !== 1) return err.notFound();
  if (course.price_cents > 0) return err.conflict("This course requires payment");

  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const email = parsed.data.email.toLowerCase();

  let contactId: string | null = null;
  const existing = row<{ id: string }>("SELECT id FROM contacts WHERE tenant_id = ? AND email = ?", course.tenant_id, email);
  if (existing) {
    contactId = existing.id;
    run("UPDATE contacts SET updated_at = ? WHERE id = ?", nowIso(), contactId);
  } else {
    const org = row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", course.tenant_id);
    const limits = getLimits(org?.plan ?? "free");
    const used = getUsage(course.tenant_id, "contacts");
    if (limits.contacts !== -1 && used >= limits.contacts) return err.conflict("This creator has reached their contact limit");
    contactId = newId("con");
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 'course', '[]', ?, ?)",
      contactId,
      course.tenant_id,
      email,
      parsed.data.name,
      nowIso(),
      nowIso()
    );
    // Free enrolment must consume the metered contact allowance too, otherwise
    // the cap is trivially bypassed via free courses.
    bumpUsage(course.tenant_id, "contacts");
  }

  const { enrollment } = ensureEnrollment(course.tenant_id, course.id, email, "free", { contactId });
  return ok({ enrollmentId: enrollment.id });
}
