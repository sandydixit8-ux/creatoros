"use client";

import { useState } from "react";
import { Check, Instagram, Link2, Linkedin, Loader2, Music2, Twitter, Youtube } from "lucide-react";

export interface ProfileData {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  website: string;
  timezone: string;
  socials: Record<string, string>;
}

const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

export function ProfileForm({ initial, hasProfile }: { initial: ProfileData; hasProfile: boolean }) {
  const [form, setForm] = useState<ProfileData>({ ...initial, socials: { ...initial.socials } });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function setSocial(key: string, value: string) {
    setForm((f) => ({ ...f, socials: { ...f.socials, [key]: value } }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: hasProfile ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) setMsg({ type: "ok", text: "Profile saved. Check your public page." });
      else setMsg({ type: "err", text: j.error?.message || "Could not save profile" });
    } catch {
      setMsg({ type: "err", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-navy-900">Public profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="profile-username">Username</label>
            <div className="flex items-center gap-1 rounded-xl border border-navy-200 bg-white px-3 focus-within:border-brand-500">
              <span className="text-sm text-brand-600">@</span>
              <input
                id="profile-username"
                className="w-full bg-transparent py-2 text-sm text-navy-900 focus:outline-none"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                placeholder="yourname"
              />
            </div>
            {!hasProfile && <p className="mt-1 text-xs text-navy-400">Choose your unique handle.</p>}
          </div>
          <div>
            <label className="label" htmlFor="profile-display-name">Display name</label>
            <input id="profile-display-name" className="input" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profile-bio">Bio</label>
            <textarea id="profile-bio" className="input min-h-[80px]" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Who you are and what you help with…" />
          </div>
          <div>
            <label className="label" htmlFor="profile-avatar">Avatar URL</label>
            <input id="profile-avatar" className="input" value={form.avatarUrl} onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))} placeholder="https://…" />
          </div>
          <div>
            <label className="label" htmlFor="profile-website">Website</label>
            <input id="profile-website" className="input" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profile-timezone">Default timezone (booking)</label>
            <select id="profile-timezone" className="input" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-navy-900">Social links</h2>
        <p className="mb-4 text-sm text-navy-500">Shown as icons on your bio page.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SocialInput icon={Instagram} label="Instagram" value={form.socials.instagram || ""} onChange={(v) => setSocial("instagram", v)} />
          <SocialInput icon={Youtube} label="YouTube" value={form.socials.youtube || ""} onChange={(v) => setSocial("youtube", v)} />
          <SocialInput icon={Twitter} label="X / Twitter" value={form.socials.twitter || ""} onChange={(v) => setSocial("twitter", v)} />
          <SocialInput icon={Linkedin} label="LinkedIn" value={form.socials.linkedin || ""} onChange={(v) => setSocial("linkedin", v)} />
          <SocialInput icon={Music2} label="TikTok" value={form.socials.tiktok || ""} onChange={(v) => setSocial("tiktok", v)} />
        </div>
      </div>

      {msg && (
        <div className={`card px-4 py-3 text-sm ${msg.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : msg?.type === "ok" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

function SocialInput(props: { icon: typeof Instagram; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="label">{props.label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-3 focus-within:border-brand-500">
        <props.icon className="h-4 w-4 text-navy-400" />
        <input
          className="w-full bg-transparent py-2 text-sm text-navy-900 focus:outline-none"
          aria-label={props.label}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder="https://…"
        />
      </div>
    </div>
  );
}