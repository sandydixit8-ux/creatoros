"use client";

import { useState } from "react";
import { Check, Loader2, Mail, Plus, Send, Trash2, Users } from "lucide-react";

export interface CampaignRow {
  id: string;
  list_id: string | null;
  template_id: string | null;
  subject: string;
  from_name: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  stats: { sent: number; failed: number; total: number; opened: number; clicked: number };
  created_at: string;
}

export interface ListRow {
  id: string;
  name: string;
  created_at: string;
  memberCount: number;
}

export interface ContactRow {
  id: string;
  email: string;
  name: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

type Tab = "campaigns" | "lists" | "templates";

export function EmailCenter(props: {
  initialCampaigns: CampaignRow[];
  initialLists: ListRow[];
  initialContacts: ContactRow[];
  initialMemberships: { list_id: string; contact_id: string }[];
  initialTemplates: TemplateRow[];
  canWrite: boolean;
  emailAutomation: boolean;
}) {
  const [tab, setTab] = useState<Tab>("campaigns");
  const campaigns = props.initialCampaigns;
  const lists = props.initialLists;
  const templates = props.initialTemplates;
  const memberships = props.initialMemberships;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<ListRow | null>(lists[0] ?? null);
  const [toast, setToast] = useState("");

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const TABS: Array<{ key: Tab; label: string; icon: typeof Mail }> = [
    { key: "campaigns", label: "Campaigns", icon: Mail },
    { key: "lists", label: "Lists", icon: Users },
    { key: "templates", label: "Templates", icon: Plus },
  ];

  async function sendCampaign(id: string) {
    if (!props.emailAutomation) return notify("Email automation requires a paid plan");
    setBusyId(id);
    try {
      const res = await fetch(`/api/email/campaigns/${id}/send`, { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        notify(`Sent! ${j.data.sent} delivered, ${j.data.failed} failed`);
        window.location.reload();
      } else {
        notify(j.error?.message || "Could not send");
      }
    } catch {
      notify("Network error");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(kind: "campaign" | "list" | "template", id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/email/${kind}s/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) {
        notify("Deleted");
        window.location.reload();
      } else {
        notify(j.error?.message || "Could not delete");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-brand-600 text-white" : "bg-white text-navy-600 hover:bg-navy-50"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {toast && <div className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white">{toast}</div>}

      {tab === "campaigns" && (
        <div className="space-y-4">
          <CampaignForm
            lists={lists}
            templates={templates}
            canWrite={props.canWrite}
            onDone={() => window.location.reload()}
          />
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-navy-900">Broadcasts</h2>
            {campaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy-400">No broadcasts yet. Compose one above.</p>
            ) : (
              <ul className="space-y-2">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-navy-900">
                        {c.subject}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor(c.status)}`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-500">
                        {c.status === "sent" || c.status === "partial" || c.status === "failed" ? (
                          <>
                            <span>{c.stats.total} recipients</span>
                            <span>{c.stats.opened} opened</span>
                            <span>{c.stats.clicked} clicked</span>
                            <span className={c.stats.failed ? "font-medium text-amber-700" : ""}>
                              {c.stats.failed} failed
                            </span>
                          </>
                        ) : (
                          <span>Draft{c.from_name ? ` · from ${c.from_name}` : ""}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {c.status !== "sent" && c.status !== "sending" && c.status !== "partial" && props.canWrite && (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => sendCampaign(c.id)}
                          className="btn-primary !px-3 !py-1.5 text-xs"
                          title={
                            c.status === "failed"
                              ? "Retry: the previous attempt delivered nothing"
                              : undefined
                          }
                        >
                          {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          {c.status === "failed" ? "Retry" : "Send"}
                        </button>
                      )}
                      {c.status === "partial" && (
                        <span
                          className="self-center rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                          title="Some recipients already received this email. Retrying the whole campaign would email them again."
                        >
                          Partially sent
                        </span>
                      )}
                      {props.canWrite && (
                        <button
                          type="button"
                          onClick={() => deleteItem("campaign", c.id)}
                          className="btn-secondary !px-3 !py-1.5 text-xs text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "lists" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="card p-5">
            <ListForm canWrite={props.canWrite} onDone={() => window.location.reload()} />
            <ul className="mt-3 space-y-2">
              {lists.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setActiveList(l)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      activeList?.id === l.id ? "border-brand-300 bg-brand-50" : "border-navy-100 hover:bg-navy-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-navy-900">
                      <Users className="h-4 w-4 text-brand-500" /> {l.name}
                    </span>
                    <span className="text-xs text-navy-400">{l.memberCount || 0} members</span>
                  </button>
                </li>
              ))}
            </ul>
            {lists.length === 0 && <p className="py-4 text-center text-sm text-navy-400">No lists yet.</p>}
          </div>

          <div className="card p-5">
            <ListMembersEditor
              list={activeList}
              contacts={props.initialContacts}
              memberships={memberships}
              canWrite={props.canWrite}
            />
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="card p-5">
            <TemplateForm canWrite={props.canWrite} onDone={() => window.location.reload()} />
            <ul className="mt-3 space-y-2">
              {templates.map((t) => (
                <li key={t.id} className="group flex items-center justify-between rounded-xl border border-navy-100 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-navy-900">{t.name}</div>
                    <div className="truncate text-xs text-navy-500">{t.subject}</div>
                  </div>
                  {props.canWrite && (
                    <button
                      type="button"
                      onClick={() => deleteItem("template", t.id)}
                      className="btn-secondary !px-3 !py-1.5 text-xs text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {templates.length === 0 && <p className="py-4 text-center text-sm text-navy-400">No templates yet.</p>}
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-navy-900">Tip</h3>
            <p className="mt-1 text-sm text-navy-600">
              Use placeholders in subject &amp; body: <code className="rounded bg-navy-50 px-1">{"{{name}}"}</code>,{" "}
              <code className="rounded bg-navy-50 px-1">{"{{email}}"}</code>,{" "}
              <code className="rounded bg-navy-50 px-1">{"{{unsubscribe_url}}"}</code>. Create a template, then pick it when
              composing a campaign.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    sent: "bg-emerald-50 text-emerald-700",
    partial: "bg-amber-50 text-amber-700",
    sending: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
    draft: "bg-navy-50 text-navy-600",
    canceled: "bg-navy-50 text-navy-600",
    scheduled: "bg-sky-50 text-sky-700",
  };
  return map[status] || "bg-navy-50 text-navy-600";
}

function CampaignForm(props: { lists: ListRow[]; templates: TemplateRow[]; canWrite: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ listId: "", templateId: "", subject: "", body: "", fromName: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, listId: form.listId || null, templateId: form.templateId || null }),
      });
      const j = await res.json();
      if (j.ok) {
        setOpen(false);
        props.onDone();
      } else {
        setError(j.error?.message || "Could not create campaign");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="card border-brand-200 bg-brand-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-navy-700">Compose a newsletter or broadcast</p>
          {props.canWrite && (
            <button type="button" onClick={() => setOpen(true)} className="btn-primary !py-2 text-sm">
              <Plus className="h-4 w-4" /> New campaign
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card border-brand-200 bg-brand-50/60 p-5">
      <h3 className="mb-3 font-semibold text-navy-900">New campaign</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">List</label>
          <select className="input bg-white" value={form.listId} onChange={(e) => setForm((f) => ({ ...f, listId: e.target.value }))}>
            <option value="">All subscribed contacts</option>
            {props.lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Template (optional)</label>
          <select
            className="input bg-white"
            value={form.templateId}
            onChange={(e) => {
              const t = props.templates.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, templateId: e.target.value, subject: t?.subject ?? f.subject, body: t?.body ?? f.body }));
            }}
          >
            <option value="">None</option>
            {props.templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From name</label>
          <input className="input" value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} placeholder="Demo Creator" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Subject</label>
          <input className="input" required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="New tools for creators" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Body (HTML)</label>
          <textarea
            className="input min-h-[140px] font-mono text-xs"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder={"<p>Hey {{name}},</p><p>This week&apos;s picks…</p>"}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary !py-2 text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Creating…" : "Create draft"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function ListForm(props: { canWrite: boolean; onDone: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/email/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = await res.json();
      if (j.ok) {
        setName("");
        props.onDone();
      } else {
        setError(j.error?.message || "Could not create list");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="New list name" disabled={!props.canWrite} />
      <button type="submit" disabled={saving || !props.canWrite} className="btn-primary shrink-0 !py-2 text-sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        New
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

function TemplateForm(props: { canWrite: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        setOpen(false);
        setForm({ name: "", subject: "", body: "" });
        props.onDone();
      } else {
        setError(j.error?.message || "Could not create template");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-navy-900">Templates</h2>
        {props.canWrite && (
          <button type="button" onClick={() => setOpen(true)} className="btn-primary !py-2 text-sm">
            <Plus className="h-4 w-4" /> New template
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Weekly digest" />
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="This week in creator tools" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Body (HTML)</label>
          <textarea className="input min-h-[120px] font-mono text-xs" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder={"<p>Hi {{name}},</p>…"} />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary !py-2 text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save template
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function ListMembersEditor(props: {
  list: ListRow | null;
  contacts: ContactRow[];
  memberships: { list_id: string; contact_id: string }[];
  canWrite: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const members = props.contacts.filter((c) => props.memberships.some((m) => m.list_id === props.list?.id && m.contact_id === c.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    if (!props.list || selected.size === 0) return;
    const res = await fetch(`/api/email/lists/${props.list.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [...selected], replace: false }),
    });
    if (res.ok) window.location.reload();
  }

  const candidates = props.contacts.filter((c) => !members.some((m) => m.id === c.id));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold text-navy-900">{props.list ? props.list.name : "Select a list"}</h3>
        {props.list && <span className="text-xs text-navy-400">{members.length} members</span>}
      </div>

      {props.list && (
        <>
          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-500">Add from subscribed contacts</div>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-navy-100 p-2">
              {candidates.length === 0 ? (
                <p className="px-2 py-3 text-center text-sm text-navy-400">All subscribed contacts are in this list.</p>
              ) : (
                candidates.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-50">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={!props.canWrite} />
                    <span className="font-medium text-navy-800">{c.name || c.email}</span>
                    <span className="ml-auto text-xs text-navy-400">{c.email}</span>
                  </label>
                ))
              )}
            </div>
            <button type="button" onClick={add} disabled={selected.size === 0 || !props.canWrite} className="btn-primary mt-2 !py-2 text-sm">
              Add selected
            </button>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-500">Members</div>
            {members.length === 0 ? (
              <p className="py-4 text-center text-sm text-navy-400">No members yet.</p>
            ) : (
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2 text-sm">
                    <span className="font-medium text-navy-800">{m.name || m.email}</span>
                    <span className="text-xs text-navy-400">{m.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}