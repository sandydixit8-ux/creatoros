import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { row } from "@/lib/db/db";
import { ProfileForm } from "@/components/settings/profile-form";
import { PrivacySection } from "@/components/settings/privacy-section";
import { SupportForm } from "@/components/settings/support-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const p = row<{ username: string; display_name: string; bio: string; avatar_url: string; website: string; timezone: string; socials: string }>(
    "SELECT username, display_name, bio, avatar_url, website, timezone, socials FROM profiles WHERE tenant_id = ? AND user_id = ?",
    s.org.id,
    s.user.id
  );

  const initial = p
    ? {
        username: p.username,
        displayName: p.display_name,
        bio: p.bio,
        avatarUrl: p.avatar_url,
        website: p.website,
        timezone: p.timezone,
        socials: safeJson<Record<string, string>>(p.socials),
      }
    : { username: "", displayName: s.user.name, bio: "", avatarUrl: "", website: "", timezone: "UTC", socials: {} };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Settings</h1>
        <p className="mt-1 text-sm text-navy-500">Your public profile — this powers your bio page.</p>
      </div>
      <ProfileForm initial={initial} hasProfile={!!p} />
      <PrivacySection orgSlug={s.org.slug} isOwner={s.role === "owner"} />
      <SupportForm />
    </div>
  );
}

function safeJson<T>(s: string, fb: T = {} as T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fb;
  }
}