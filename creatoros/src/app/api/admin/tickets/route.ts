import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { isVerifiedPlatformAdmin } from "@/lib/admin/access";
import { listOpenTickets, VALID_TICKET_STATUSES } from "@/lib/admin/engine";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isVerifiedPlatformAdmin(s.user)) return err.forbidden();
  return ok({ tickets: listOpenTickets(), statuses: VALID_TICKET_STATUSES });
}