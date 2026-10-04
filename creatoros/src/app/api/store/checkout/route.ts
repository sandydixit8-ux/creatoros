import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { row } from "@/lib/db/db";
import { getPaymentProviderForCurrency, cashfreeSdkMode } from "@/lib/payments";
import { getProduct, createOrderForProduct, attachCheckoutSession } from "@/lib/store/orders";
import { getLimits } from "@/lib/plans";
import { getUsage } from "@/lib/usage";
import { SITE_URL } from "@/lib/constants";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const checkoutSchema = z.object({
  productId: z.string().min(1).max(60),
  email: z.string().email(),
  name: z.string().max(120).default(""),
  pageSlug: z.string().default(""),
  visitorId: z.string().default(""),
  phone: z.string().max(20).optional().default(""),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("store_checkout", ip), 20);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const product = getProduct(parsed.data.productId);
  if (!product || product.active !== 1) return err.notFound();

  const provider = getPaymentProviderForCurrency(product.currency);
  if (!provider.isConfigured()) {
    return err.server();
  }

  // A configured provider that cannot settle this currency would fail at the
  // gateway, so say so up front instead of creating a doomed order.
  if (!provider.supportsCurrency(product.currency)) {
    return err.conflict(`${product.currency.toUpperCase()} payments are not available yet`);
  }

  // Cashfree rejects an order without customer_phone, so validate before the
  // order row is created rather than failing after Cashfree has been called.
  if (provider.requiresCustomerPhone && !parsed.data.phone.trim()) {
    return err.validation({ phone: "A phone number is required for payment" });
  }

  // Respect tenant contact limit for brand-new buyers (existing contacts always allowed).
  const email = parsed.data.email.toLowerCase();
  const existingContact = row("SELECT id FROM contacts WHERE tenant_id = ? AND email = ?", product.tenant_id, email);
  if (!existingContact) {
    const org = row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", product.tenant_id);
    const limits = getLimits(org?.plan ?? "free");
    const used = getUsage(product.tenant_id, "contacts");
    if (limits.contacts !== -1 && used >= limits.contacts) return err.conflict("This creator has reached their contact limit");
  }

  const profile = row<{ username: string }>("SELECT username FROM profiles WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1", product.tenant_id);

  const order = createOrderForProduct(product, {
    email,
    name: parsed.data.name,
    pageId: product.page_id,
    visitorId: parsed.data.visitorId,
    source: "store",
  });

  try {
    const session = await provider.createCheckoutSession({
      lines: [{ title: product.name, amountCents: product.price_cents, quantity: 1 }],
      currency: product.currency,
      successUrl: `${SITE_URL}/api/store/checkout/success?order=${order.id}`,
      cancelUrl: `${SITE_URL}/u/${profile?.username ?? ""}`,
      customerEmail: email,
      customerPhone: parsed.data.phone || undefined,
      metadata: { orderId: order.id, tenantId: product.tenant_id },
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
    // The provider reason is the only way to debug a declined currency,
    // customer field or gateway rule, so log it instead of swallowing it.
    console.error(`[store-checkout] ${provider.name} session failed for order ${order.id}:`, e);
    return err.server();
  }
}
