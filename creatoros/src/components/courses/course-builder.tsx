"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmAction } from "@/components/ui/confirm-action";

interface Lesson {
  id: string;
  section_id: string;
  course_id: string;
  title: string;
  type: string;
  content: string;
  duration_min: number;
  position: number;
  published: number;
}

interface Section {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  cover_url: string;
  published: number;
}

const LESSON_TYPES = ["video", "audio", "pdf", "text", "quiz", "external"] as const;
const QUIZ_PLACEHOLDER = '{"question":"What is 2 + 2?","options":["3","4","5"],"answerIndex":1}';

export function CourseBuilder(props: {
  initialCourse: Course;
  initialSections: Section[];
  students: number;
  username: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [course, setCourse] = useState<Course>(props.initialCourse);
  const [sections, setSections] = useState<Section[]>(props.initialSections);
  const [students, setStudents] = useState(props.students);
  const [meta, setMeta] = useState({
    title: props.initialCourse.title,
    description: props.initialCourse.description,
    price: (props.initialCourse.price_cents / 100).toFixed(2),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [lessonForm, setLessonForm] = useState<{ sectionId: string; title: string; type: string; content: string; duration: string } | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [editForm, setEditForm] = useState({ title: "", type: "text", content: "", duration: "0", published: true });

  async function refresh() {
    const res = await fetch(`/api/courses/${course.id}`);
    const j = await res.json();
    if (j.ok) {
      setCourse(j.data.course);
      setSections(j.data.sections);
      setStudents(j.data.students);
      setMeta((m) => ({ ...m, title: j.data.course.title, description: j.data.course.description, price: (j.data.course.price_cents / 100).toFixed(2) }));
    }
  }

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const priceCents = Math.round(parseFloat(meta.price || "0") * 100);
      const res = await fetch(`/api/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: meta.title, description: meta.description, price_cents: Number.isNaN(priceCents) ? 0 : priceCents }),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error?.message || "Could not save");
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    await fetch(`/api/courses/${course.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: course.published !== 1 }),
    });
    await refresh();
    router.refresh();
  }

  async function deleteCourse() {
    await fetch(`/api/courses/${course.id}`, { method: "DELETE" });
    router.push("/app/courses");
  }

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionTitle.trim()) return;
    await fetch(`/api/courses/${course.id}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: sectionTitle.trim() }),
    });
    setSectionTitle("");
    await refresh();
  }

  async function removeSection(sectionId: string) {
    await fetch(`/api/courses/sections/${sectionId}`, { method: "DELETE" });
    await refresh();
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonForm) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/${course.id}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: lessonForm.sectionId,
          title: lessonForm.title,
          type: lessonForm.type,
          content: lessonForm.content,
          duration_min: parseInt(lessonForm.duration || "0", 10) || 0,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setLessonForm(null);
        await refresh();
      } else {
        setError(j.error?.message || "Could not add lesson");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveLesson() {
    if (!editLesson) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/lessons/${editLesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          type: editForm.type,
          content: editForm.content,
          duration_min: parseInt(editForm.duration || "0", 10) || 0,
          published: editForm.published,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setEditLesson(null);
        setError("");
        await refresh();
      } else {
        setError(j.error?.message || "Could not save lesson");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeLesson(lessonId: string) {
    await fetch(`/api/courses/lessons/${lessonId}`, { method: "DELETE" });
    await refresh();
  }

  const publicUrl = course.published && props.username ? `/u/${props.username}/courses/${course.slug}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Link href="/app/courses" className="inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-900">
          <ArrowLeft className="h-4 w-4" /> All courses
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-navy-500">{students} students</span>
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-secondary !py-2 text-sm">
              <ExternalLink className="h-4 w-4" /> View
            </a>
          )}
          {props.canWrite && (
            <button
              type="button"
              onClick={togglePublish}
              className={`btn !py-2 text-sm ${course.published ? "bg-emerald-600 text-white hover:bg-emerald-700" : "btn-primary"}`}
            >
              {course.published ? "Published" : "Publish"}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={saveMeta} className="card grid gap-3 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="course-title">Title</label>
          <input id="course-title" className="input" disabled={!props.canWrite} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="course-description">Description</label>
          <textarea id="course-description" className="input" rows={3} disabled={!props.canWrite} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="course-price">Price (USD, 0 = free)</label>
          <input id="course-price" className="input" disabled={!props.canWrite} inputMode="decimal" value={meta.price} onChange={(e) => setMeta({ ...meta, price: e.target.value })} />
        </div>
        {error && <p className="self-end text-xs text-red-600">{error}</p>}
        {props.canWrite && (
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save details"}
            </button>
            <ConfirmAction
              message={`Delete "${course.title}" and all its lessons? Enrollments are removed too.`}
              onConfirm={deleteCourse}
              trigger={
                <>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete course
                </>
              }
              triggerClassName="btn-secondary !py-2 text-sm"
            />
          </div>
        )}
      </form>

      <div className="card p-5">
        <h2 className="font-semibold text-navy-900">Curriculum</h2>

        {sections.length === 0 && (
          <p className="mt-3 text-sm text-navy-400">No sections yet. Add your first section (e.g. &ldquo;Week 1&rdquo;).</p>
        )}

        <div className="mt-4 space-y-4">
          {sections.map((sec) => (
            <div key={sec.id} className="rounded-xl border border-navy-100">
              <div className="flex items-center justify-between gap-3 border-b border-navy-100 bg-navy-50/60 px-4 py-2.5">
                <span className="text-sm font-semibold text-navy-900">{sec.title}</span>
                {props.canWrite && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLessonForm({ sectionId: sec.id, title: "", type: "text", content: "", duration: "0" })}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      + Lesson
                    </button>
                    <ConfirmAction
                      message="Delete this section and its lessons?"
                      onConfirm={() => removeSection(sec.id)}
                      ariaLabel="Delete section"
                      triggerClassName="text-navy-400 hover:text-red-600"
                    />
                  </div>
                )}
              </div>

              <div className="divide-y divide-navy-50">
                {sec.lessons.length === 0 && <p className="px-4 py-3 text-xs text-navy-400">No lessons in this section.</p>}
                {sec.lessons.map((les) => (
                  <div key={les.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm ${les.published ? "text-navy-800" : "text-navy-400 line-through"}`}>{les.title}</span>
                        <span className="rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-navy-500">{les.type}</span>
                      </div>
                      {les.duration_min > 0 && <div className="text-xs text-navy-400">{les.duration_min} min</div>}
                    </div>
                    {props.canWrite && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditLesson(les);
                            setEditForm({
                              title: les.title,
                              type: les.type,
                              content: les.content,
                              duration: String(les.duration_min),
                              published: les.published === 1,
                            });
                            setError("");
                          }}
                          className="text-navy-400 hover:text-brand-600"
                          aria-label="Edit lesson"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <ConfirmAction
                          message="Delete this lesson?"
                          onConfirm={() => removeLesson(les.id)}
                          ariaLabel="Delete lesson"
                          triggerClassName="text-navy-400 hover:text-red-600"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {lessonForm?.sectionId === sec.id && (
                <form onSubmit={addLesson} className="space-y-2 border-t border-navy-100 bg-brand-50/40 p-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input className="input sm:col-span-2" required maxLength={160} placeholder="Lesson title" aria-label="Lesson title" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
                    <select className="input" aria-label="Lesson type" value={lessonForm.type} onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value, content: e.target.value === "quiz" && !lessonForm.content ? QUIZ_PLACEHOLDER : lessonForm.content })}>
                      {LESSON_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="input font-mono text-xs"
                    rows={lessonForm.type === "quiz" ? 4 : 3}
                    placeholder={lessonForm.type === "quiz" ? QUIZ_PLACEHOLDER : lessonForm.type === "video" ? "Video URL (YouTube/Vimeo/mp4)" : lessonForm.type === "pdf" ? "PDF URL" : "Lesson content"}
                    aria-label="Lesson content"
                    value={lessonForm.content}
                    onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <input className="input w-28" inputMode="numeric" placeholder="Min" aria-label="Lesson duration in minutes" value={lessonForm.duration} onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })} />
                    <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add lesson"}
                    </button>
                    <button type="button" onClick={() => setLessonForm(null)} className="btn-secondary !py-2 text-sm">
                      <X className="h-4 w-4" /> Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>

        {props.canWrite && (
          <form onSubmit={addSection} className="mt-4 flex gap-2">
            <input className="input" required maxLength={160} placeholder="New section (e.g. Week 1)" aria-label="New section title" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} />
            <button type="submit" className="btn-primary shrink-0 !py-2 text-sm">
              <Plus className="h-4 w-4" /> Add section
            </button>
          </form>
        )}
      </div>

      {editLesson && (
        <div className="card space-y-2 border-brand-200 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Edit lesson</h2>
            <button type="button" onClick={() => setEditLesson(null)} className="text-navy-400 hover:text-navy-700" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="input sm:col-span-2" aria-label="Lesson title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            <select className="input" aria-label="Lesson type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
              {LESSON_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <textarea
            className="input font-mono text-xs"
            rows={editForm.type === "quiz" ? 4 : 3}
            aria-label="Lesson content"
            value={editForm.content}
            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input className="input w-28" inputMode="numeric" aria-label="Lesson duration in minutes" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-navy-600">
              <input type="checkbox" checked={editForm.published} onChange={(e) => setEditForm({ ...editForm, published: e.target.checked })} />
              Published
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={saveLesson} disabled={busy} className="btn-primary !py-2 text-sm">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save lesson"}
              </button>
              <button type="button" onClick={() => setEditLesson(null)} className="btn-secondary !py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
