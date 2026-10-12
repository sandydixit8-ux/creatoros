"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface Flag {
  id: string;
  flag: string;
  enabled: boolean;
}

const KNOWN_FLAGS = ["maintenance", "signups_open", "ai_coach", "ai_assistant", "email_delivery"];

export function FlagsPanel({ initial }: { initial: Flag[] }) {
  const [flags, setFlags] = useState(initial);

  const known = KNOWN_FLAGS.map((flag) => flags.find((f) => f.flag === flag) ?? { id: "", flag, enabled: true });
  const other = flags.filter((f) => !KNOWN_FLAGS.includes(f.flag));

  async function toggle(flag: Flag | { id: string; flag: string; enabled: boolean }) {
    const next = !flag.enabled;
    if (flag.id) setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled: next } : f)));
    const res = await fetch("/api/admin/flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flag: flag.flag, enabled: next }),
    });
    if (!res.ok) return;
    const json = await res.json();
    if (json.ok) setFlags((prev) => {
      const exists = prev.some((f) => f.flag === flag.flag);
      return exists ? prev.map((f) => (f.flag === flag.flag ? { ...f, enabled: next } : f)) : [...prev, { id: `${Date.now()}`, flag: flag.flag, enabled: next }];
    });
  }

  return (
    <div className="space-y-2">
      {known.concat(other).map((f) => (
        <div key={f.flag} className="card flex items-center justify-between p-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-navy-900">
              <RefreshCw className="h-3.5 w-3.5 text-navy-400" />
              {f.flag}
            </div>
            <div className="text-xs text-navy-400">Global feature switch</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={f.enabled}
            aria-label={`Toggle ${f.flag}`}
            onClick={() => toggle(f)}
            className={`relative h-6 w-11 rounded-full transition-colors ${f.enabled ? "bg-brand-600" : "bg-navy-200"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${f.enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      ))}
    </div>
  );
}