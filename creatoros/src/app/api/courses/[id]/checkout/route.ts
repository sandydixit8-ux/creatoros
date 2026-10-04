import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { getCourse, enrollmentFor } from "@/lib/courses/engine";
import { createOrderForCourse, attachCheckoutSession } from "@/lib/store/orders";
import { getPaymentProviderForCurrency, cashfreeSdkMode } from "@/lib/payments";
import { row } from "@/lib/db/db";
import { SITE_URL } from "@/lib/constants";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(120).default(""),
  visitorId: z.string().default(""),
  phone: z.string().max(20).optional().default(""),
});

/** Paid course checkout → provider session (enrollment happens on fulfillment). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("course_checkout", ip), 20);
  if (!rl.allowed) return err.rateLimited();

  const { id } = await params;
  const course = getCourse(id);
  if (!course || course.published !== 1) return err.notFound();
  if (course.price_cents <= 0) return err.conflict("This course is free — use enroll");

  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  if (enrollmentFor(course.tenant_id, course.id, parsed.data.email)) {
    return err.conflict("This email is already enrolled");
  }

  const provider = getPaymentProviderForCurrency(course.currency);
  if (!provider.isConfigured()) return err.server();

  if (!provider.supportsCurrency(course.currency)) {
    return err.conflict(`${course.currency.toUpperCase()} payments are not available yet`);
  }

  // Cashfree rejects an order without customer_phone, so validate before the
  // order row is created rather than failing after Cashfree has been called.
  if (provider.requiresCustomerPhone && !parsed.data.phone.trim()) {
    return err.validation({ phone: "A phone number is required for payment" });
  }

  const profile = row<{ username: string }>("SELECT username FROM profiles WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1", course.tenant_id);
  const order = createOrderForCourse(course, {
    email: parsed.data.email,
    name: parsed.data.name,
    visitorId: parsed.data.visitorId,
  });

  try {
    const session = await provider.createCheckoutSession({
      lines: [{ title: course.title, amountCents: course.price_cents, quantity: 1 }],
      currency: course.currency,
      successUrl: `${SITE_URL}/api/store/checkout/success?order=${order.id}`,
      cancelUrl: `${SITE_URL}/u/${profile?.username ?? ""}`,
      customerEmail: parsed.data.email,
      customerPhone: parsed.data.phone || undefined,
      metadata: { orderId: order.id, tenantId: course.tenant_id, courseId: course.id },
    });
    attachCheckoutSession(order.id, provider.name, session.sessionId);
    // Cashfree cannot be opened by URL: the browser SDK needs the session id.
    // sdkMode is sent from the server so the client never reads server env.
    return ok({
      url: session.url ?? null,
      clientSessionId: session.clientSessionId ?? null,
      sdk: session.clientSessionId ? "cashfree" : null,
      sdkMode: session.clientSessionId ? cashfreeSdkMode() : null,
      orderId: order.id,
    });
  } catch (e) {
    console.error(`[course-checkout] ${provider.name} session failed for order ${order.id}:`, e);
    return err.server();
  }
}
