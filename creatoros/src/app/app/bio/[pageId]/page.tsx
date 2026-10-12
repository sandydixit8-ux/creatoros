import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { row, all } from "@/lib/db/db";
import { BioEditor, type BlockType } from "@/components/bio/editor";
import { getProfileForUser } from "@/lib/bio/page";
import { listTrackedLinks } from "@/lib/analytics/links";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BioEditorPage({ params }: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) redirect("/auth/login");
  const { pageId } = await params;

  const page = row<{ id: string; slug: string; title: string; published: number; theme: string; tenant_id: string }>(
    "SELECT id, slug, title, published, theme, tenant_id FROM bio_pages WHERE id = ? AND tenant_id = ?",
    pageId,
    s.org.id
  );
  if (!page) notFound();

  const blocks = all<{ id: string; type: string; payload: string; position: number; active: number }>(
    "SELECT id, type, payload, position, active FROM bio_blocks WHERE page_id = ? ORDER BY position ASC",
    pageId
  );
  const profile = getProfileForUser(s.org.id, s.user.id);
  const services = all<{ id: string; name: string; slug: string; duration_min: number }>(
    "SELECT id, name, slug, duration_min FROM services WHERE tenant_id = ? AND active = 1",
    s.org.id
  );
  const trackedLinks = listTrackedLinks(s.org.id)
    .filter((l) => l.active)
    .map((l) => ({ slug: l.slug, label: l.label || l.slug }));

  return (
    <BioEditor
      pageId={page.id}
      initialPage={{ slug: page.slug, title: page.title, published: !!page.published, theme: safeJson(page.theme) as Record<string, string> }}
      initialBlocks={blocks.map((b) => ({ id: b.id, type: b.type as BlockType, payload: safeJson(b.payload) as Record<string, string>, position: b.position, active: !!b.active }))}
      username={profile?.username ?? ""}
      services={services}
      trackedLinks={trackedLinks}
      siteUrl={SITE_URL}
    />
  );
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}