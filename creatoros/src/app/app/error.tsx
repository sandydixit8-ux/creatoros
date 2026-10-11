"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div role="alert" className="card max-w-2xl border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
        <div>
          <h1 className="font-semibold text-navy-900">Something went wrong</h1>
          <p className="mt-1 text-sm text-navy-600">
            This part of the dashboard hit an unexpected error. Your data is safe — try again.
          </p>
          {error.digest && <p className="mt-2 text-xs text-navy-400">Reference: {error.digest}</p>}
          <button type="button" onClick={() => retry()} className="btn-primary mt-4 !py-2 text-sm">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}