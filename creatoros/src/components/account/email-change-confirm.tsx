"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

type Result = { applied: boolean; side: "current" | "new"; newEmail: string; alreadyConfirmed: boolean };

function ConfirmInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/account/email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!active) return;
        if (json.ok) {
          setResult(json.data as Result);
          setState("done");
        } else {
          setState("error");
          setMessage(json.error?.message || "We could not confirm this link.");
        }
      } catch {
        if (active) {
          setState("error");
          setMessage("Network error. Please try again.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-navy-700">This link is missing its confirmation token.</p>
        <Link href="/app/settings" className="btn-primary block w-full py-2.5">Back to settings</Link>
      </div>
    );
  }

  if (state === "working") {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-navy-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
      </div>
    );
  }

  if (state === "done" && result) {
    if (result.applied) {
      return (
        <div className="space-y-4 text-center">
          <p className="text-sm text-navy-700">
            Your login email is now <span className="font-medium">{result.newEmail}</span>. For security, please sign in again.
          </p>
          <Link href="/auth/login" className="btn-primary block w-full py-2.5">Go to login</Link>
        </div>
      );
    }
    const other = result.side === "current" ? result.newEmail : "your current email address";
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-navy-700">
          {result.alreadyConfirmed ? "This side is already confirmed." : "Confirmed."} To finish, open the confirmation link we sent to {other}.
        </p>
        <Link href="/app/settings" className="btn-primary block w-full py-2.5">Back to settings</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-navy-700">{message}</p>
      <Link href="/app/settings" className="btn-primary block w-full py-2.5">Back to settings</Link>
    </div>
  );
}

export function EmailChangeConfirm() {
  return (
    <Suspense fallback={<div className="py-6 text-center text-sm text-navy-500">Loading…</div>}>
      <ConfirmInner />
    </Suspense>
  );
}
