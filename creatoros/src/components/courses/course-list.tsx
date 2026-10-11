"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Users, BookOpen } from "lucide-react";

interface CourseListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  published: number;
  created_at: string;
  updated_at: string;
  lessons: number;
  students: number;
}

export function CourseList(props: { canWrite: boolean }) {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/courses")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: { courses: CourseListItem[] } }) => {
        if (!cancelled && j.ok && j.data) {
          setCourses(j.data.courses);
          setLoaded(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const priceCents = Math.round(parseFloat(price || "0") * 100);
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, price_cents: Number.isNaN(priceCents) ? 0 : priceCents }),
      });
      const j = await res.json();
      if (j.ok) {
        router.push(`/app/courses/${j.data.courseId}`);
      } else {
        setError(j.error?.message || "Could not create course");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <div className="card p-8 text-center text-sm text-navy-500">Loading courses…</div>;
  }

  return (
    <div className="space-y-4">
      {props.canWrite && !showForm && (
        <div className="card border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-navy-700">Create your next course</p>
            <button type="button" onClick={() => { setShowForm(true); setError(""); }} className="btn-primary !py-2 text-sm">
              <Plus className="h-4 w-4" /> New course
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={create} className="card grid gap-3 border-brand-200 bg-brand-50/60 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="new-course-title">Course title</label>
            <input id="new-course-title" className="input" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Complete design masterclass" />
          </div>
          <div>
            <label className="label" htmlFor="new-course-price">Price (USD, 0 = free)</label>
            <input id="new-course-price" className="input" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.00" />
          </div>
          {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & open builder"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary !py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="card p-5">
        {courses.length === 0 ? (
          <div className="py-10 text-center text-sm text-navy-400">No courses yet. Create your first one to start teaching.</div>
        ) : (
          <div className="divide-y divide-navy-50">
            {courses.map((c) => (
              <Link key={c.id} href={`/app/courses/${c.id}`} className="flex items-center justify-between gap-4 py-4 transition hover:bg-navy-50/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-navy-900">{c.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.published ? "bg-emerald-50 text-emerald-700" : "bg-navy-100 text-navy-500"}`}>
                      {c.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-navy-400">
                    <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {c.lessons} lessons</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.students} students</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-navy-900">{c.price_cents === 0 ? "Free" : `$${(c.price_cents / 100).toFixed(2)}`}</div>
                  <div className="text-xs text-navy-400">{c.updated_at.slice(0, 10)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
