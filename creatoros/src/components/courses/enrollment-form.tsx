"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function EnrollmentForm(props: { courseId: string; isPaid: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ enrollmentId?: string; url?: string; message?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const endpoint = props.isPaid ? `/api/courses/${props.courseId}/checkout` : `/api/courses/${props.courseId}/enroll`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, phone }),
      });
      const j = await res.json();
      if (j.ok && j.data) {
        setResult(j.data);
        if (j.data.url) {
          window.location.href = j.data.url;
        }
      } else {
        setError(j.error?.message || "Something went wrong");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (result?.url) return null;
  if (result?.enrollmentId) {
    return (
      <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <p className="font-medium">You&apos;re enrolled!</p>
        <p className="mt-1 text-emerald-700">Create an account with this email, then start learning in your dashboard.</p>
        <button type="button" onClick={() => router.push("/app/learn")} className="mt-2 font-medium text-emerald-700 underline hover:text-emerald-900">
          Go to My learning →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        className="input w-52 !py-2 text-sm"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="input w-40 !py-2 text-sm"
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {props.isPaid && (
        <input
          type="tel"
          inputMode="tel"
          required
          className="input w-40 !py-2 text-sm"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      )}
      {props.isPaid ? (
        <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy now"}
        </button>
      ) : (
        <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enroll free"}
        </button>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}