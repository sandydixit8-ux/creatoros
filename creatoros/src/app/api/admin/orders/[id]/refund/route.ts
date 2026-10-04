import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { isPlatformAdmin } from "@/lib/admin/access";
import { getPaymentProvider, providerByName } from "@/lib/payments";
import { row, run, tx, newId, nowIso } from "@/lib/db/db";
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

/** The claim taken in phase 1 and carried through the gateway call. */
interface RefundIntent {
  intentId: string;
  orderId: string;
  tenantId: string;
  sessionId: string;
  providerName: string;
  amountCents: number;
  totalRefunded: number;
  fullyRefunded: boolean;
  alreadyRefunded: number;
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

  /**
   * Phase 1 - claim the refund, inside one transaction.
   *
   * The intent row is written and the ledger re-read under the same lock, so a
   * second admin request that arrives while the first is still talking to the
   * gateway cannot compute the same "remaining" figure and refund twice. The
   * partial unique index on (order_id) WHERE status='pending' is the backstop.
   */
  let intent: RefundIntent;
  try {
    intent = tx(() => {
      const fresh = row<RefundableOrder>(
        "SELECT id, tenant_id, status, provider, provider_session_id, amount_cents, refunded_cents FROM orders WHERE id = ?",
        id
      );
      if (!fresh) throw new RefundError("not_found", "Order not found");
      if (fresh.status !== "paid") {
        throw new RefundError("conflict", `Only paid orders can be refunded (this one is ${fresh.status})`);
      }
      if (!fresh.provider_session_id) {
        throw new RefundError("conflict", "This order has no provider session recorded");
      }

      const inFlight = row<{ id: string; amount_cents: number }>(
        "SELECT id, amount_cents FROM refunds WHERE order_id = ? AND status = 'pending'",
        fresh.id
      );
      if (inFlight) {
        throw new RefundError(
          "conflict",
          `A refund of ${inFlight.amount_cents} cents is already in flight for this order. Check with the provider before retrying.`
        );
      }

      const already = fresh.refunded_cents || 0;
      const remaining = fresh.amount_cents - already;
      if (remaining <= 0) throw new RefundError("conflict", "This order has already been fully refunded");

      const amount = parsed.data.amountCents ?? remaining;
      if (amount > remaining) {
        throw new RefundValidationError(`Cannot refund more than the remaining ${remaining} cents on this order`);
      }

      const intentId = newId("ref");
      run(
        `INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, reason, admin_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, (SELECT currency FROM orders WHERE id = ?), ?, 'pending', ?, ?, ?, ?)`,
        intentId,
        fresh.tenant_id,
        fresh.id,
        amount,
        fresh.id,
        fresh.provider ?? "mock",
        parsed.data.reason,
        s.user.email,
        nowIso(),
        nowIso()
      );

      const totalRefunded = already + amount;
      return {
        intentId,
        orderId: fresh.id,
        tenantId: fresh.tenant_id,
        sessionId: fresh.provider_session_id,
        providerName: fresh.provider ?? "mock",
        amountCents: amount,
        totalRefunded,
        fullyRefunded: totalRefunded >= fresh.amount_cents,
        alreadyRefunded: already,
      };
    });
  } catch (e) {
    if (e instanceof RefundValidationError) {
      return err.validation({ amountCents: [e.message] });
    }
    if (e instanceof RefundError) {
      return e.code === "not_found" ? err.notFound() : err.conflict(e.message);
    }
    throw e;
  }

  const provider = providerByName(intent.providerName) ?? getPaymentProvider();
  if (!provider.isConfigured()) {
    releaseIntent(intent.intentId);
    return err.server();
  }

  /**
   * Phase 2 - talk to the gateway, outside any transaction. Holding a write lock
   * across a network call to a payment provider would serialise every admin
   * action behind the provider's latency.
   */
  let providerRefundId: string;
  try {
    const { refundId } = await provider.refundPayment({
      sessionId: intent.sessionId,
      amountCents: intent.amountCents,
    });
    providerRefundId = refundId;
  } catch (e) {
    // The gateway refused, so no money moved. Release the claim so an admin can
    // retry, and keep a `failed` row as the audit trail of the attempt.
    releaseIntent(intent.intentId);
    return err.conflict(e instanceof Error ? e.message : "Refund failed at provider");
  }

  /**
   * Phase 3 - commit the outcome. The gateway has already moved the money, so
   * these writes are applied together or not at all; a `pending` intent left in
   * place is the signal that the two have diverged and needs a human.
   */
  try {
    tx(() => {
      run(
        "UPDATE refunds SET status = 'succeeded', provider_refund_id = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
        providerRefundId,
        nowIso(),
        intent.intentId
      );
      run(
        "UPDATE orders SET refunded_cents = ?, status = ?, updated_at = ? WHERE id = ?",
        intent.totalRefunded,
        intent.fullyRefunded ? "refunded" : "paid",
        nowIso(),
        intent.orderId
      );
      if (intent.fullyRefunded) {
        run("UPDATE payments SET status = 'refunded' WHERE order_id = ? AND status IN ('pending', 'succeeded')", intent.orderId);
      }
      audit({
        tenantId: intent.tenantId,
        action: "admin.order_refunded",
        resource: intent.orderId,
        ip: getClientIp(req),
        meta: {
          refundId: providerRefundId,
          intentId: intent.intentId,
          amountCents: intent.amountCents,
          totalRefunded: intent.totalRefunded,
          fullyRefunded: intent.fullyRefunded,
          provider: provider.name,
          reason: parsed.data.reason,
          admin: s.user.email,
        },
      });
    });
  } catch {
    // The money moved but the ledger did not. Leave the intent pending and let
    // it be surfaced rather than silently re-refunding later.
    return err.server();
  }

  return ok({
    refundId: providerRefundId,
    orderId: intent.orderId,
    amountCents: intent.amountCents,
    totalRefunded: intent.totalRefunded,
    fullyRefunded: intent.fullyRefunded,
    provider: provider.name,
  });
}

/** Mark an in-flight intent as failed so the order can be retried. */
function releaseIntent(intentId: string): void {
  try {
    tx(() => {
      run("UPDATE refunds SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'", nowIso(), intentId);
    });
  } catch {
    // Best effort. A stuck `pending` intent blocks retries, which is the safe
    // direction to fail in: better to make an admin look than to double-refund.
    // swallowed: a stuck pending intent is the safe direction to fail in.
  }
}

class RefundError extends Error {
  constructor(
    readonly code: "not_found" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "RefundError";
  }
}

class RefundValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundValidationError";
  }
}
