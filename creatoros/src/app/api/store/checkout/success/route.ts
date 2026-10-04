import { NextRequest } from "next/server";
import { row } from "@/lib/db/db";
import { getPaymentProvider, providerByName } from "@/lib/payments";
import { fulfillOrder, type OrderRow } from "@/lib/store/orders";

/**
 * Browser return URL after checkout. Confirms payment server-side via the
 * provider (or waits for the webhook), then redirects to the public receipt.
 * The frontend never marks an order paid.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order") || "";
  const sessionId = req.nextUrl.searchParams.get("session_id") || "";

  const order = row<OrderRow>("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order) return Response.redirect(new URL("/", req.url), 303);

  if (order.status === "pending") {
    const sessionMatches = !sessionId || sessionId === order.provider_session_id;
    if (sessionMatches) {
      const provider = providerByName(order.provider) ?? getPaymentProvider();
      const status = sessionId ? await provider.getCheckoutPaymentStatus(sessionId) : "unknown";
      if (status === "paid") fulfillOrder(order.id);
    }
  }

  return Response.redirect(new URL(`/store/receipt/${order.token}`, req.url), 303);
}
