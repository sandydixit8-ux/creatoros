import { all, row, run, tx, newId, nowIso, nanoid } from "@/lib/db/db";
import { trackEvent, hashVisitorId } from "@/lib/analytics/engine";
import { bumpUsage } from "@/lib/usage";
import { audit } from "@/lib/audit";
import { ensureEnrollment } from "@/lib/courses/engine";
import { recordFunnelEvent } from "@/lib/funnel";

export interface ProductRow {
  id: string;
  tenant_id: string;
  page_id: string | null;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  kind: string;
  media_url: string;
  active: number;
}

export interface OrderRow {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  email: string;
  status: string;
  amount_cents: number;
  currency: string;
  provider: string;
  provider_session_id: string;
  course_id: string;
  token: string;
  created_at: string;
  updated_at: string;
}

export function getProduct(productId: string): ProductRow | undefined {
  return row<ProductRow>("SELECT * FROM products WHERE id = ?", productId);
}

export function countProducts(tenantId: string): number {
  return Number(all<{ c: number }>("SELECT COUNT(*) AS c FROM products WHERE tenant_id = ?", tenantId)[0]?.c ?? 0);
}

/** Create a pending order (single product) and link/refresh the buyer contact. */
export function createOrderForProduct(
  product: ProductRow,
  input: { email: string; name?: string; pageId?: string | null; visitorId?: string; source?: string }
): OrderRow {
  const email = input.email.toLowerCase();

  let contactId: string | null = null;
  const existing = row<{ id: string }>("SELECT id FROM contacts WHERE tenant_id = ? AND email = ?", product.tenant_id, email);
  if (existing) {
    contactId = existing.id;
    // Buying is not consent to marketing. `consent` is only ever set by an
    // explicit opt-in (see /api/leads/capture), never by a transactional path.
    run("UPDATE contacts SET updated_at = ? WHERE id = ?", nowIso(), contactId);
  } else {
    contactId = newId("con");
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, page_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, '[]', ?, ?)",
      contactId,
      product.tenant_id,
      email,
      input.name ?? "",
      input.source ?? "store",
      input.pageId ?? null,
      nowIso(),
      nowIso()
    );
    bumpUsage(product.tenant_id, "contacts");
  }

  const orderId = newId("ord");
  const amount = product.price_cents;
  run(
    "INSERT INTO orders (id, tenant_id, contact_id, email, status, amount_cents, currency, provider, token, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, 'pending-provider', ?, ?, ?)",
    orderId,
    product.tenant_id,
    contactId,
    email,
    amount,
    product.currency,
    nanoid(24),
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO order_items (id, order_id, tenant_id, product_id, title, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?, 1, ?)",
    newId("oit"),
    orderId,
    product.tenant_id,
    product.id,
    product.name,
    amount
  );

  if (input.visitorId) {
    trackEvent({
      tenantId: product.tenant_id,
      pageId: input.pageId ?? undefined,
      eventType: "checkout_started",
      visitorId: hashVisitorId(input.visitorId),
      ref: "store",
    });
  }

  return row<OrderRow>("SELECT * FROM orders WHERE id = ?", orderId)!;
}

/** Pending order for a paid course (enrollment happens on fulfillment). */
export function createOrderForCourse(
  course: { id: string; tenant_id: string; title: string; price_cents: number; currency: string },
  input: { email: string; name?: string; visitorId?: string }
): OrderRow {
  const email = input.email.toLowerCase();

  let contactId: string | null = null;
  const existing = row<{ id: string }>("SELECT id FROM contacts WHERE tenant_id = ? AND email = ?", course.tenant_id, email);
  if (existing) {
    contactId = existing.id;
    run("UPDATE contacts SET updated_at = ? WHERE id = ?", nowIso(), contactId);
  } else {
    contactId = newId("con");
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 'course', '[]', ?, ?)",
      contactId,
      course.tenant_id,
      email,
      input.name ?? "",
      nowIso(),
      nowIso()
    );
    bumpUsage(course.tenant_id, "contacts");
  }

  const orderId = newId("ord");
  run(
    "INSERT INTO orders (id, tenant_id, contact_id, email, status, amount_cents, currency, provider, course_id, token, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, 'pending-provider', ?, ?, ?, ?)",
    orderId,
    course.tenant_id,
    contactId,
    email,
    course.price_cents,
    course.currency,
    course.id,
    nanoid(24),
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO order_items (id, order_id, tenant_id, product_id, title, quantity, unit_price_cents) VALUES (?, ?, ?, NULL, ?, 1, ?)",
    newId("oit"),
    orderId,
    course.tenant_id,
    course.title,
    course.price_cents
  );

  if (input.visitorId) {
    trackEvent({ tenantId: course.tenant_id, eventType: "checkout_started", visitorId: hashVisitorId(input.visitorId), ref: "course" });
  }

  return row<OrderRow>("SELECT * FROM orders WHERE id = ?", orderId)!;
}

/** Record the provider session on the order + its pending payment row. */
export function attachCheckoutSession(orderId: string, providerName: string, sessionId: string): void {
  run("UPDATE orders SET provider = ?, provider_session_id = ?, updated_at = ? WHERE id = ?", providerName, sessionId, nowIso(), orderId);
  run(
    "INSERT INTO payments (id, tenant_id, provider, provider_id, amount_cents, currency, status, order_id, created_at) SELECT ?, tenant_id, ?, ?, amount_cents, currency, 'pending', ?, ? FROM orders WHERE id = ?",
    newId("pay"),
    providerName,
    sessionId,
    orderId,
    nowIso(),
    orderId
  );
}

export type FulfillResult = "paid" | "already_paid" | "not_found" | "not_payable";

/**
 * Idempotent order fulfillment: safe to call from success route and webhook.
 *
 * Everything that constitutes "the customer got what they paid for" happens in
 * one transaction: the order flip, the payment row, the enrolment, the sales
 * usage counter and the audit entry.
 *
 * This matters because of what used to happen. The order was flipped to `paid`
 * first and the enrolment was created afterwards as a separate write. If
 * enrolment then failed, the customer had paid and been marked fulfilled but
 * could not access the course - and because the `already_paid` guard returns
 * early on every later attempt, no retry could ever repair it. The failure was
 * terminal and silent.
 *
 * Now a failure anywhere rolls the whole thing back. The order stays `pending`,
 * so a later webhook or return-visit retry can still fulfil it, and the caller
 * gets a real error instead of a cheerful `already_paid`.
 */
export function fulfillOrder(orderId: string): FulfillResult {
  return tx(() => {
    const order = row<OrderRow>("SELECT * FROM orders WHERE id = ?", orderId);
    if (!order) return "not_found";
    if (order.status === "paid") return "already_paid";
    if (order.status !== "pending") return "not_payable";

    const res = run(
      "UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ? AND status = 'pending'",
      nowIso(),
      orderId
    );
    if (res.changes === 0) return "already_paid";

    run("UPDATE payments SET status = 'succeeded' WHERE order_id = ? AND status = 'pending'", orderId);
    if (order.course_id) {
      ensureEnrollment(order.tenant_id, order.course_id, order.email, "purchase", {
        orderId,
        contactId: order.contact_id,
      });
    }
    trackEvent({ tenantId: order.tenant_id, eventType: "purchase", ref: order.course_id ? "course" : "store" });
    bumpUsage(order.tenant_id, "sales");
    audit({ tenantId: order.tenant_id, action: "store.order_paid", resource: orderId });
    // Platform funnel: a one-time sale is a paying customer even though it is not
    // a subscription. Recorded inside the same transaction so the funnel cannot
    // claim a sale the order table does not show.
    recordFunnelEvent({
      step: "purchase_completed",
      tenantId: order.tenant_id,
      plan: order.course_id ? "course" : "product",
      currency: order.currency,
      amountCents: order.amount_cents,
      source: order.provider,
      meta: { orderId, course: Boolean(order.course_id) },
    });
    return "paid";
  });
}

/** Find an order by its provider checkout session id. */
export function orderBySession(sessionId: string): OrderRow | undefined {
  return row<OrderRow>("SELECT * FROM orders WHERE provider_session_id = ?", sessionId);
}

/** Settle an order identified by its provider session id (webhook path). */
export function fulfillOrderBySession(sessionId: string): FulfillResult {
  const order = orderBySession(sessionId);
  if (!order) return "not_found";
  return fulfillOrder(order.id);
}

export function markOrderFailed(orderId: string, status: "failed" | "canceled" | "refunded"): void {
  run("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'paid')", status, nowIso(), orderId);
  const paymentStatus = status === "refunded" ? "refunded" : status;
  run("UPDATE payments SET status = ? WHERE order_id = ? AND status IN ('pending', 'succeeded')", paymentStatus, orderId);
}

export function getOrderItems(orderId: string) {
  return all<{ id: string; title: string; quantity: number; unit_price_cents: number; product_id: string | null }>(
    "SELECT id, title, quantity, unit_price_cents, product_id FROM order_items WHERE order_id = ?",
    orderId
  );
}
