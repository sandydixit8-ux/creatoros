"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Mail, ShieldCheck, ShieldOff } from "lucide-react";

type Msg = { type: "ok" | "err"; text: string } | null;

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json() as Promise<{
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
  }>;
}

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
      {msg.text}
    </div>
  );
}

export interface AccountSettingsProps {
  name: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
}

export function AccountSettings({ name, email, role, twoFactorEnabled }: AccountSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-navy-950">Account settings</h2>
        <p className="mt-1 text-sm text-navy-500">Manage your name, password, two-factor authentication and login email.</p>
      </div>
      <PersonalInfo initialName={name} email={email} role={role} />
      <ChangePassword />
      <TwoFactor enabled={twoFactorEnabled} />
      <ChangeEmail currentEmail={email} />
    </div>
  );
}

function PersonalInfo({ initialName, email, role }: { initialName: string; email: string; role: string }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const j = await post("/api/account/name", { name });
    setMsg(j.ok ? { type: "ok", text: "Name updated" } : { type: "err", text: j.error?.message || "Could not save" });
    setSaving(false);
  }

  return (
    <section className="card p-6">
      <h3 className="font-semibold text-navy-900">Personal information</h3>
      <p className="mt-1 text-sm text-navy-500">Your name and the email you sign in with.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="acct-name">Name</label>
          <input id="acct-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="label" htmlFor="acct-email">Login email</label>
          <input id="acct-email" className="input" value={email} readOnly disabled />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-medium capitalize text-navy-700">{role}</span>
      </div>
      <div className="mt-4 space-y-3">
        <Notice msg={msg} />
        <button type="button" onClick={save} disabled={saving || !name.trim() || name === initialName} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save name"}
        </button>
      </div>
    </section>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setMsg({ type: "err", text: "New passwords do not match" });
      return;
    }
    setSaving(true);
    setMsg(null);
    const j = await post("/api/account/password", { currentPassword: current, newPassword: next });
    if (j.ok) {
      setMsg({ type: "ok", text: "Password changed. Other devices have been signed out." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      setMsg({ type: "err", text: j.error?.message || "Could not change password" });
    }
    setSaving(false);
  }

  return (
    <section className="card p-6">
      <h3 className="font-semibold text-navy-900">Password</h3>
      <p className="mt-1 text-sm text-navy-500">Keep your account secure with a strong, unique password.</p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" required autoComplete="current-password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pw-new">New password</label>
            <input id="pw-new" type="password" required minLength={10} autoComplete="new-password" className="input" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 10 characters" />
          </div>
          <div>
            <label className="label" htmlFor="pw-confirm">Confirm new password</label>
            <input id="pw-confirm" type="password" required minLength={10} autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <Notice msg={msg} />
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
        </button>
      </form>
    </section>
  );
}

function TwoFactor({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disPw, setDisPw] = useState("");
  const [disCode, setDisCode] = useState("");

  async function start() {
    setBusy(true);
    setMsg(null);
    const j = await post("/api/account/2fa/setup");
    if (j.ok && j.data) {
      setSetup({ qrDataUrl: String(j.data.qrDataUrl), secret: String(j.data.secret) });
    } else {
      setMsg({ type: "err", text: j.error?.message || "Could not start setup" });
    }
    setBusy(false);
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const j = await post("/api/account/2fa/enable", { code });
    if (j.ok && j.data) {
      setOn(true);
      setSetup(null);
      setCode("");
      setBackupCodes((j.data.backupCodes as string[]) || []);
      setMsg({ type: "ok", text: "Two-factor authentication is on. Save your backup codes." });
    } else {
      setMsg({ type: "err", text: j.error?.message || "Could not enable 2FA" });
    }
    setBusy(false);
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const j = await post("/api/account/2fa/disable", { password: disPw, code: disCode });
    if (j.ok) {
      setOn(false);
      setDisabling(false);
      setDisPw("");
      setDisCode("");
      setBackupCodes([]);
      setMsg({ type: "ok", text: "Two-factor authentication is off." });
    } else {
      setMsg({ type: "err", text: j.error?.message || "Could not disable 2FA" });
    }
    setBusy(false);
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        {on ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldOff className="h-4 w-4 text-navy-500" />}
        <h3 className="font-semibold text-navy-900">Two-factor authentication</h3>
        {on && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">On</span>}
      </div>
      <p className="mt-1 text-sm text-navy-500">
        Add a second step at login using an authenticator app (Google Authenticator, 1Password, Authy).
      </p>

      <div className="mt-4 space-y-3">
        <Notice msg={msg} />

        {!on && !setup && (
          <button type="button" onClick={start} disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable two-factor"}
          </button>
        )}

        {!on && setup && (
          <form onSubmit={enable} className="space-y-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qrDataUrl} alt="Scan this QR code with your authenticator app" className="h-44 w-44 rounded-lg border border-navy-200" />
              <div className="text-sm text-navy-600">
                <p className="font-medium text-navy-800">Scan the QR code</p>
                <p className="mt-1">Or enter this key manually:</p>
                <code className="mt-1 block break-all rounded bg-navy-50 px-2 py-1 font-mono text-xs text-navy-800">{setup.secret}</code>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="tfa-code">Enter the 6-digit code</label>
              <input id="tfa-code" value={code} onChange={(e) => setCode(e.target.value)} required inputMode="numeric" autoComplete="one-time-code" maxLength={16} className="input max-w-[12rem]" placeholder="123456" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.length < 6} className="btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify and enable"}
              </button>
              <button type="button" onClick={() => { setSetup(null); setCode(""); setMsg(null); }} className="rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        {backupCodes.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Save your backup codes</p>
            <p className="mt-1 text-xs text-amber-700">
              Store these somewhere safe. Each works once if you lose your authenticator. They are shown only now.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm text-navy-800">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button type="button" onClick={copyCodes} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy codes"}
            </button>
          </div>
        )}

        {on && !disabling && (
          <button type="button" onClick={() => { setDisabling(true); setMsg(null); }} className="rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50">
            Turn off
          </button>
        )}

        {on && disabling && (
          <form onSubmit={disable} className="space-y-4">
            <div>
              <label className="label" htmlFor="tfa-off-pw">Password</label>
              <input id="tfa-off-pw" type="password" required autoComplete="current-password" className="input" value={disPw} onChange={(e) => setDisPw(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="tfa-off-code">Current code or a backup code</label>
              <input id="tfa-off-code" required className="input max-w-[12rem]" value={disCode} onChange={(e) => setDisCode(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !disPw || !disCode} className="btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Turn off 2FA"}
              </button>
              <button type="button" onClick={() => { setDisabling(false); setDisPw(""); setDisCode(""); setMsg(null); }} className="rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function ChangeEmail({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, setPending] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const j = await post("/api/account/email", { newEmail, password });
    if (j.ok) {
      setPending(String(j.data?.newEmail || newEmail));
      setNewEmail("");
      setPassword("");
      setMsg({ type: "ok", text: "Verification links sent. Confirm from both inboxes to finish." });
    } else {
      setMsg({ type: "err", text: j.error?.message || "Could not start the change" });
    }
    setSaving(false);
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-navy-500" />
        <h3 className="font-semibold text-navy-900">Change email</h3>
      </div>
      <p className="mt-1 text-sm text-navy-500">
        Changing your login email updates your access everywhere. Verification of both your current and new email is required.
      </p>
      <p className="mt-3 text-sm text-navy-700">Current email: <span className="font-medium">{currentEmail}</span></p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="email-new">New email</label>
          <input id="email-new" type="email" required className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="email-password">Confirm with your password</label>
          <input id="email-password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Notice msg={msg} />
        {pending && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Waiting for both confirmations for <strong>{pending}</strong>. Check both inboxes.
          </p>
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification links"}
        </button>
      </form>
    </section>
  );
}
