"use client";

import { useState } from "react";
import { Download, Loader2, Trash2, LogOut, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrivacySection({ orgSlug, isOwner }: { orgSlug: string; isOwner: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function call(path: string, body: Record<string, string>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  }

  async function leaveWorkspace() {
    setBusy(true);
    setMsg(null);
    try {
      const json = await call("/api/account/leave", {});
      if (!json.ok) {
        setMsg({ type: "err", text: json.error?.message || "Could not leave workspace" });
        setBusy(false);
        return;
      }
      if (json.data?.accountDeleted) {
        router.push("/auth/login?deleted=1");
        return;
      }
      // Still a member elsewhere: the server re-pointed the session, so land in
      // the product rather than the login screen.
      router.push("/app");
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Network error" });
      setBusy(false);
    }
  }

  async function deleteWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== "DELETE") {
      setMsg({ type: "err", text: "Type DELETE to confirm" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const json = await call("/api/account/delete", { confirm, orgSlug });
      if (json.ok) {
        router.push("/auth/login?deleted=1");
      } else {
        setMsg({ type: "err", text: json.error?.message || "Could not delete workspace" });
        setBusy(false);
      }
    } catch {
      setMsg({ type: "err", text: "Network error" });
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-navy-900">Export your data</h2>
        <p className="mb-4 text-sm text-navy-500">
          Download a copy of everything this account stores (GDPR data portability).
        </p>
        <a href="/api/account/export" className="btn-secondary inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export as JSON
        </a>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-navy-900">Leave this workspace</h2>
        <p className="mb-4 text-sm text-navy-500">
          Removes only your own membership. Your teammates keep their access and all workspace data
          is preserved. If this is your only workspace, your account is deleted.
        </p>
        <button
          type="button"
          onClick={leaveWorkspace}
          disabled={busy}
          className="btn-secondary inline-flex items-center gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Leave workspace
        </button>
      </div>

      {isOwner ? (
        <div className="card border-red-200 p-6">
          <h2 className="mb-1 font-semibold text-red-700">Delete workspace</h2>
          <p className="mb-1 text-sm text-navy-500">
            Permanently deletes this workspace and all associated data (leads, pages, courses,
            orders, bookings) for every member. This cannot be undone. Consider exporting first.
          </p>
          <form
            onSubmit={deleteWorkspace}
            className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
          >
            <input
              className="input max-w-[220px]"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type DELETE"
              aria-label="Type DELETE to confirm"
            />
            <button
              type="submit"
              disabled={busy || confirm !== "DELETE"}
              className="btn-danger inline-flex items-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete workspace
            </button>
          </form>
        </div>
      ) : (
        <div className="card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Only the workspace owner can delete the workspace. Use &ldquo;Leave this workspace&rdquo; to
          remove your own access.
        </div>
      )}

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            msg.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.type === "err" && <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}