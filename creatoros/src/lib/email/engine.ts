import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { sendEmail, renderTokens, buildUnsubscribeUrl, EmailResult } from "@/lib/email/mailer";
import { bumpUsage, getUsage } from "@/lib/usage";
import { getLimits } from "@/lib/plans";

export interface CampaignRow {
  id: string;
  tenant_id: string;
  list_id: string | null;
  template_id: string | null;
  subject: string;
  body: string;
  from_name: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  stats: string;
  created_at: string;
}

export interface SendRow {
  id: string;
  email: string;
  subject: string;
  status: string;
  provider_id: string;
  error: string;
  sent_at: string | null;
  created_at: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

/** Contacts eligible for a campaign: onboard, consented, not unsubscribed. */
export function recipientsFor(tenantId: string, listId?: string | null): Array<{ id: string; email: string; name: string }> {
  const unsub = all<{ email: string }>(
    "SELECT email FROM unsubscribes WHERE tenant_id = ?",
    tenantId
  ).map((u) => u.email.toLowerCase());

  const base =
    listId
      ? `SELECT c.id, c.email, c.name FROM email_list_members m JOIN contacts c ON c.id = m.contact_id WHERE m.list_id = ? AND c.consent = 1`
      : `SELECT id, email, name FROM contacts WHERE tenant_id = ? AND consent = 1`;
  const params: unknown[] = listId ? [listId] : [tenantId];

  return (all<{ id: string; email: string; name: string }>(base, ...(params as never[])) ?? []).filter(
    (c) => !unsub.includes(c.email.toLowerCase())
  );
}

function emailUsage(tenantId: string): number {
  const limit = getLimits((row("SELECT plan FROM organizations WHERE id = ?", tenantId) as { plan?: string })?.plan ?? "free").emailsPerMonth;
  return limit === -1 ? -1 : getUsage(tenantId, "emails");
}

export function canSendMore(tenantId: string): boolean {
  return emailUsage(tenantId) === -1 || emailUsage(tenantId) < getLimits((row("SELECT plan FROM organizations WHERE id = ?", tenantId) as { plan?: string })?.plan ?? "free").emailsPerMonth;
}

/** Send a campaign to all eligible recipients. Returns per-send results. */
export async function sendCampaign(campaignId: string): Promise<{ sent: number; failed: number; sends: EmailResult[] }> {
  const campaign = row<CampaignRow>("SELECT * FROM email_campaigns WHERE id = ?", campaignId);
  if (!campaign) throw new Error("campaign_not_found");

  const orgPlan = (row("SELECT plan FROM organizations WHERE id = ?", campaign.tenant_id) as { plan?: string })?.plan ?? "free";
  const limits = getLimits(orgPlan);
  if (!limits.emailAutomation) throw new Error("email_automation_requires_plan");

  const recipients = recipientsFor(campaign.tenant_id, campaign.list_id);

  run("UPDATE email_campaigns SET status = 'sending', updated_at = ? WHERE id = ?", nowIso(), campaignId);
  const sends: EmailResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const rcpt of recipients) {
    if (!canSendMore(campaign.tenant_id)) {
      failed += 1;
      continue;
    }
    const subject = renderTokens(campaign.subject, { name: rcpt.name, email: rcpt.email });
    const html = renderTokens(campaign.body, {
      name: rcpt.name,
      email: rcpt.email,
      unsubscribe_url: buildUnsubscribeUrl(campaign.tenant_id, rcpt.email),
      site_name: "CreatorOS",
    });

    let result: EmailResult;
    try {
      result = await sendEmail({ to: rcpt.email, toName: rcpt.name, subject, html, fromName: campaign.from_name || undefined });
      run("INSERT INTO email_sends (id, tenant_id, campaign_id, contact_id, email, subject, status, provider_id, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?)", newId("ems"), campaign.tenant_id, campaignId, rcpt.id, rcpt.email, subject, result.providerId, nowIso(), nowIso());
      bumpUsage(campaign.tenant_id, "emails");
      sent += 1;
    } catch (e) {
      run("INSERT INTO email_sends (id, tenant_id, campaign_id, contact_id, email, subject, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?)", newId("ems"), campaign.tenant_id, campaignId, rcpt.id, rcpt.email, subject, (e as Error).message, nowIso());
      failed += 1;
      result = { provider: "log", providerId: "" };
    }
    sends.push(result);
  }

  const stats = { sent, failed, total: recipients.length };
  // A campaign that only partly delivered must not read as "sent": that hides
  // bounce storms and quota burn behind a success label.
  const status = sent === 0 ? "failed" : failed === 0 ? "sent" : "partial";
  run(
    "UPDATE email_campaigns SET status = ?, sent_at = ?, stats = ?, updated_at = ? WHERE id = ?",
    status,
    nowIso(),
    JSON.stringify(stats),
    nowIso(),
    campaignId
  );

  return { sent, failed, sends };
}

export function campaignStats(c: { stats: string }): { sent: number; failed: number; total: number } {
  try {
    return JSON.parse(c.stats || "{}") as { sent: number; failed: number; total: number };
  } catch {
    return { sent: 0, failed: 0, total: 0 };
  }
}

/** Count engaged sends for a campaign. */
export function campaignEngagement(campaignId: string): { opened: number; clicked: number } {
  const opened = (row<{ c: number }>("SELECT COUNT(*) AS c FROM email_sends WHERE campaign_id = ? AND opened_at IS NOT NULL", campaignId) as { c?: number })?.c ?? 0;
  const clicked = (row<{ c: number }>("SELECT COUNT(*) AS c FROM email_sends WHERE campaign_id = ? AND clicked_at IS NOT NULL", campaignId) as { c?: number })?.c ?? 0;
  return { opened, clicked };
}

export function listSends(campaignId: string): SendRow[] {
  return all<SendRow>(
    "SELECT id, email, subject, status, provider_id, error, sent_at, created_at FROM email_sends WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 100",
    campaignId
  );
}