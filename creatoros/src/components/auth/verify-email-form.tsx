"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!active) return;
        if (json.ok) {
          setState("done");
        } else {
          setState("error");
          setMessage(json.error?.message || "We could not verify this link.");
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
        <p className="text-sm text-navy-700">This link is missing its verification token.</p>
        <Link href="/auth/login" className="btn-primary block w-full py-2.5">Back to login</Link>
      </div>
    );
  }

  if (state === "working") {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-navy-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Verifying your email…
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-navy-700">Your email is verified. You can continue to your dashboard.</p>
        <Link href="/app" className="btn-primary block w-full py-2.5">Go to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-navy-700">{message}</p>
      <Link href="/auth/login" className="btn-primary block w-full py-2.5">Back to login</Link>
    </div>
  );
}

export function VerifyEmailForm() {
  return (
    <Suspense fallback={<div className="py-6 text-center text-sm text-navy-500">Loading…</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
