import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { isPlatformAdmin } from "@/lib/admin/access";
import { getPaymentProvider, providerByName } from "@/lib/payments";
import { row, run, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const schema = z.object({
  /** Omit for a full refund of whatever is still refundable. */
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(200).default("admin refund"),
});

interface RefundableOrder {
  id: string;
  tenant_id: string;
  status: string;
  provider: string | null;
  provider_session_id: string | null;
  amount_cents: number;
  refunded_cents: number;
}

/**
 * Platform-admin refund. Both providers refund by the provider session id we
 * stored at checkout, so the order must already be paid.
 *
 * Amounts are cumulative: `refunded_cents` accumulates across calls so an admin
 * can refund in instalments but never more than the order total. The order only
 * flips to `refunded` once the full amount has gone back.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();

  const rl = rateLimit(rateKey("admin_refund", s.user.id), 30);
  if (!rl.allowed) return err.rateLimited();

  const { id } = await ctx.params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const order = row<RefundableOrder>(
    "SELECT id, tenant_id, status, provider, provider_session_id, amount_cents, refunded_cents FROM orders WHERE id = ?",
    id
  );
  if (!order) return err.notFound();
  if (order.status !== "paid") return err.conflict(`Only paid orders can be refunded (this one is ${order.status})`);
  if (!order.provider_session_id) return err.conflict("This order has no provider session recorded");

  const alreadyRefunded = order.refunded_cents || 0;
  const remaining = order.amount_cents - alreadyRefunded;
  if (remaining <= 0) return err.conflict("This order has already been fully refunded");

  const amountCents = parsed.data.amountCents ?? remaining;
  if (amountCents > remaining) {
    return err.validation({
      amountCents: [`Cannot refund more than the remaining ${remaining} cents on this order`],
    });
  }

  const provider = providerByName(order.provider) ?? getPaymentProvider();
  if (!provider.isConfigured()) return err.server();

  const totalRefunded = alreadyRefunded + amountCents;
  const fullyRefunded = totalRefunded >= order.amount_cents;

  try {
    const { refundId } = await provider.refundPayment({
      sessionId: order.provider_session_id,
      amountCents,
    });

    // The gateway already moved the money, so the local update must not be
    // allowed to fail silently: record the refund and status together.
    run(
      "UPDATE orders SET refunded_cents = ?, status = ?, updated_at = ? WHERE id = ?",
      totalRefunded,
      fullyRefunded ? "refunded" : "paid",
      nowIso(),
      order.id
    );

    audit({
      tenantId: order.tenant_id,
      action: "admin.order_refunded",
      resource: order.id,
      ip: getClientIp(req),
      meta: {
        refundId,
        amountCents,
        totalRefunded,
        fullyRefunded,
        provider: provider.name,
        reason: parsed.data.reason,
        admin: s.user.email,
      },
    });

    return ok({
      refundId,
      orderId: order.id,
      amountCents,
      totalRefunded,
      fullyRefunded,
      provider: provider.name,
    });
  } catch (e) {
    return err.conflict(e instanceof Error ? e.message : "Refund failed at provider");
  }
}
