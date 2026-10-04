import { NextRequest } from "next/server";
import { row } from "@/lib/db/db";
import { getPaymentProvider, providerByName } from "@/lib/payments";
import { SITE_URL } from "@/lib/constants";
import { fulfillOrder, type OrderRow } from "@/lib/store/orders";

/**
 * Browser return URL after checkout. Confirms payment server-side via the
 * provider (or waits for the webhook), then redirects to the public receipt.
 * The frontend never marks an order paid.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order") || "";
  // Stripe appends session_id; Cashfree appends cf_order_id, which is our own
  // order id. Either may be absent, so the DB session is the source of truth.
  const returnedSession =
    req.nextUrl.searchParams.get("session_id") || req.nextUrl.searchParams.get("cf_order_id") || "";

  const order = row<OrderRow>("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order) return Response.redirect(SITE_URL, 303);

  if (order.status === "pending") {
    const expected = order.provider_session_id || "";
    // Cashfree echoes cf_order_id = our order id (its session id *is* the order
    // id); Stripe/mock echo their own session id. Accept either, and treat any
    // other value as a mismatch.
    const known = new Set([expected, order.id].filter(Boolean));
    const sessionMatches = !returnedSession || known.has(returnedSession);
    if (expected && sessionMatches) {
      const provider = providerByName(order.provider) ?? getPaymentProvider();
      const status = await provider.getCheckoutPaymentStatus(expected);
      if (status === "paid") fulfillOrder(order.id);
    }
  }

  // SITE_URL, not req.url: behind the origin proxy req.url can carry the
  // internal address, which sent buyers to localhost after paying.
  return Response.redirect(new URL(`/store/receipt/${order.token}`, SITE_URL), 303);
}
