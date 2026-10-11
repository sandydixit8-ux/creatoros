"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

export function ConfirmAction({
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  ariaLabel = "Delete",
  trigger,
  triggerClassName = "",
  className = "",
  onConfirm,
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  ariaLabel?: string;
  trigger?: React.ReactNode;
  triggerClassName?: string;
  className?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [arming, setArming] = useState(false);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
      setArming(false);
    }
  }

  if (!arming) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setArming(true)}
        className={`inline-flex items-center gap-1.5 ${triggerClassName}`}
      >
        {trigger ?? <Trash2 className="h-4 w-4" aria-hidden />}
      </button>
    );
  }

  return (
    <span role="status" className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs text-navy-600">{message}</span>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArming(false)}
        disabled={pending}
        className="rounded-lg border border-navy-200 px-2.5 py-1 text-xs font-medium text-navy-600 transition-colors hover:bg-navy-50"
      >
        {cancelLabel}
      </button>
    </span>
  );
}