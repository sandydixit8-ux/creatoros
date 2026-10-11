"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Eye, ExternalLink, GripVertical, Loader2, Plus, QrCode, Trash2, Link2 } from "lucide-react";

export type BlockType = "profile" | "bio" | "link" | "product" | "booking" | "email_capture" | "cta" | "social";

export interface EditorBlock {
  id: string;
  type: BlockType;
  payload: Record<string, string>;
  position: number;
  active: boolean;
}

interface EditorService {
  id: string;
  name: string;
  slug: string;
  duration_min: number;
}

const BLOCK_CATALOG: { type: BlockType; label: string; hint: string; defaultPayload: Record<string, string> }[] = [
  { type: "profile", label: "Profile", hint: "Avatar + name", defaultPayload: { title: "Your name", subtitle: "What you do" } },
  { type: "bio", label: "Bio", hint: "About text", defaultPayload: { text: "Helping creators monetize their audience." } },
  { type: "link", label: "Link", hint: "URL button", defaultPayload: { title: "My latest video", url: "https://example.com" } },
  { type: "product", label: "Product", hint: "Sell an item", defaultPayload: { title: "My product", price: "19", url: "" } },
  { type: "booking", label: "Booking", hint: "Book a call", defaultPayload: { serviceSlug: "" } },
  { type: "email_capture", label: "Email capture", hint: "Collect leads", defaultPayload: { title: "Get my free guide", buttonLabel: "Subscribe", destination: "bio" } },
  { type: "cta", label: "CTA button", hint: "Action button", defaultPayload: { text: "Learn more", url: "" } },
  { type: "social", label: "Socials", hint: "Social icons", defaultPayload: {} },
];

export function BioEditor(props: {
  pageId: string;
  initialPage: { slug: string; title: string; published: boolean; theme: Record<string, string> };
  initialBlocks: EditorBlock[];
  username: string;
  services: EditorService[];
}) {
  const [page, setPage] = useState(props.initialPage);
  const [blocks, setBlocks] = useState<EditorBlock[]>(props.initialBlocks);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);

  const dirty = useMemo(
    () => JSON.stringify(page) !== JSON.stringify(props.initialPage) || JSON.stringify(blocks) !== JSON.stringify(props.initialBlocks),
    [page, blocks, props.initialPage, props.initialBlocks]
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/bio/${props.pageId}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: blocks.map((b, i) => ({ id: b.id, type: b.type, position: i, payload: b.payload, active: b.active })) }),
      });
      if (res.ok) {
        const pageRes = await fetch(`/api/bio/${props.pageId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: page.title, slug: page.slug, published: page.published }),
        });
        if (pageRes.ok) {
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1600);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function addBlock(type: BlockType) {
    const entry = BLOCK_CATALOG.find((b) => b.type === type)!;
    // For booking default to first service if any
    const payload = { ...entry.defaultPayload };
    if (type === "booking" && props.services.length > 0) payload.serviceSlug = props.services[0].slug;
    const tempId = `tmp_${crypto.randomUUID()}`;
    setBlocks((prev) => [...prev, { id: tempId, type, payload, position: prev.length, active: true }]);
    void entry;
  }

  function updateBlock(id: string, patch: Partial<EditorBlock> | ((prev: EditorBlock) => EditorBlock)) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? typeof patch === "function" ? patch(b) : { ...b, ...patch } : b)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function moveBlock(from: number, to: number) {
    if (to < 0 || to >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  const publicUrl = props.username ? `/u/${props.username}${page.slug ? `/${page.slug}` : ""}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Edit bio page</h1>
          <p className="mt-1 text-sm text-navy-500">Drag to reorder. Everything saves to your page.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPreview(!preview)} className="btn-secondary">
            <Eye className="h-4 w-4" /> {preview ? "Preview off" : "Preview on"}
          </button>
          {publicUrl && (
            <Link href={publicUrl} target="_blank" className="btn-secondary">
              <ExternalLink className="h-4 w-4" /> Open
            </Link>
          )}
          <a href={`/api/bio/${props.pageId}/qr`} target="_blank" rel="noreferrer" className="btn-secondary">
            <QrCode className="h-4 w-4" /> QR
          </a>
          <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedFlash ? <Check className="h-4 w-4 text-emerald-200" /> : null}
            {saving ? "Saving…" : savedFlash ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* Editor column */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-navy-800">Page settings</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="bio-page-title">Title</label>
                <input
                  id="bio-page-title"
                  className="input"
                  value={page.title}
                  onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="bio-page-slug">Slug (optional)</label>
                <input
                  id="bio-page-slug"
                  className="input"
                  value={page.slug}
                  onChange={(e) => setPage((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-navy-700">
              <input type="checkbox" checked={page.published} onChange={(e) => setPage((p) => ({ ...p, published: e.target.checked }))} />
              Publish this page (visible to public)
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {BLOCK_CATALOG.map((b) => (
              <button key={b.type} type="button" onClick={() => addBlock(b.type)} className="btn-secondary !px-3 !py-1.5 text-xs">
                <Plus className="mr-1 inline h-3 w-3" /> {b.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {blocks.map((block, i) => (
              <BlockCard
                key={block.id}
                block={block}
                index={i}
                total={blocks.length}
                services={props.services}
                dragging={dragId === block.id}
                onMove={(step) => moveBlock(i, i + step)}
                onDragStart={() => setDragId(block.id)}
                onDropHere={() => {
                  if (dragId && dragId !== block.id) {
                    const from = blocks.findIndex((b) => b.id === dragId);
                    if (from >= 0) moveBlock(from, i);
                  }
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
                onChange={(patch) => updateBlock(block.id, patch)}
                onRemove={() => removeBlock(block.id)}
              />
            ))}
            {blocks.length === 0 && (
              <div className="card p-8 text-center text-sm text-navy-400">
                Add blocks above to build your page.
              </div>
            )}
          </div>
        </div>

        {/* Preview column */}
        {preview && (
          <PreviewPane page={page} blocks={blocks} username={props.username} />
        )}
      </div>
    </div>
  );
}

function BlockCard(props: {
  block: EditorBlock;
  index: number;
  total: number;
  services: EditorService[];
  dragging: boolean;
  onMove: (step: number) => void;
  onDragStart: () => void;
  onDropHere: () => void;
  onDragEnd: () => void;
  onChange: (patch: Partial<EditorBlock>) => void;
  onRemove: () => void;
}) {
  const { block, index } = props;

  return (
    <div
      draggable
      onDragStart={props.onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={props.onDropHere}
      onDragEnd={props.onDragEnd}
      className={`card p-4 transition ${props.dragging ? "opacity-40 ring-2 ring-brand-400" : ""}`}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 cursor-grab text-navy-300" />
        <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">{block.type}</span>
        <span className="text-xs text-navy-300">#{index + 1}</span>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Move block up"
            onClick={() => props.onMove(-1)}
            disabled={index === 0}
            className="text-navy-400 hover:text-navy-700 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Move block down"
            onClick={() => props.onMove(1)}
            disabled={index === props.total - 1}
            className="text-navy-400 hover:text-navy-700 disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => props.onChange({ active: !block.active })}
            className={`text-xs font-medium ${block.active ? "text-emerald-600" : "text-navy-400"}`}
          >
            {block.active ? "Active" : "Hidden"}
          </button>
          <button type="button" onClick={props.onRemove} aria-label="Remove block" className="text-navy-400 hover:text-red-600">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </span>
      </div>
      <div className="mt-3 pl-6">
        <BlockPayloadEditor block={block} services={props.services} onChange={props.onChange} />
      </div>
    </div>
  );
}

function BlockPayloadEditor(props: { block: EditorBlock; services: EditorService[]; onChange: (patch: Partial<EditorBlock>) => void }) {
  const { block, services } = props;
  const p = block.payload;

  switch (block.type) {
    case "profile":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name" value={(p.title as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, title: v } })} />
          <Field label="Subtitle" value={(p.subtitle as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, subtitle: v } })} />
        </div>
      );
    case "bio":
      return (
        <Field label="Bio text" value={(p.text as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, text: v } })} textarea />
      );
    case "link":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Label" value={(p.title as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, title: v } })} />
          <Field label="URL" value={(p.url as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, url: v } })} />
        </div>
      );
    case "product":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name" value={(p.title as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, title: v } })} />
          <Field label="Price" value={(p.price as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, price: v } })} />
          <Field label="Buy URL" value={(p.url as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, url: v } })} />
        </div>
      );
    case "booking":
      return (
        <div>
          <label className="label" htmlFor="bio-booking-service">Service</label>
          <select
            id="bio-booking-service"
            className="input"
            value={(p.serviceSlug as string) ?? ""}
            onChange={(e) => props.onChange({ payload: { ...p, serviceSlug: e.target.value } })}
          >
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.slug}>{s.name} ({s.duration_min} min)</option>
            ))}
          </select>
          {services.length === 0 && (
            <p className="mt-2 text-xs text-amber-600">No services yet. <Link href="/app/booking" className="underline">Create one first →</Link></p>
          )}
        </div>
      );
    case "email_capture":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Headline" value={(p.title as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, title: v } })} />
          <Field label="Button label" value={(p.buttonLabel as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, buttonLabel: v } })} />
        </div>
      );
    case "cta":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Text" value={(p.text as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, text: v } })} />
          <Field label="URL" value={(p.url as string) ?? ""} onChange={(v) => props.onChange({ payload: { ...p, url: v } })} />
        </div>
      );
    default:
      return <p className="text-xs text-navy-400">No settings for this block.</p>;
  }
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <span className="label">{props.label}</span>
      {props.textarea ? (
        <textarea className="input min-h-[72px]" aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input className="input" aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      )}
    </div>
  );
}

function PreviewPane(props: { page: { title: string }; blocks: EditorBlock[]; username: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-navy-500">
        <Link2 className="h-3.5 w-3.5" /> Live preview
      </div>
      <div className="rounded-2xl border border-navy-100 bg-gradient-to-b from-navy-50 to-brand-50 p-4">
        <div className="mx-auto max-w-[300px]">
          {props.blocks.some((b) => b.active) ? (
            <div className="space-y-3">
              {props.blocks.filter((b) => b.active).map((b) => (
                <PreviewBlock key={b.id} block={b} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-navy-200 bg-white p-6 text-center text-xs text-navy-400">
              {props.username ? `@${props.username}` : props.page.title || "Your page"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ block }: { block: EditorBlock }) {
  const p = block.payload;
  switch (block.type) {
    case "profile":
      return (
        <div className="rounded-2xl bg-white p-4 text-center shadow-soft">
          <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700" />
          <div className="mt-2 text-sm font-semibold text-navy-900">{p.title || "Your name"}</div>
          <div className="text-xs text-navy-500">{p.subtitle || ""}</div>
        </div>
      );
    case "email_capture":
      return (
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="text-sm font-semibold text-navy-900">{p.title || "Subscribe"}</div>
          <div className="mt-2 flex gap-2">
            <input className="input !py-1.5 text-xs" placeholder="you@example.com" readOnly />
            <button type="button" className="btn-primary !px-3 !py-1.5 text-xs">{p.buttonLabel || "Join"}</button>
          </div>
        </div>
      );
    case "link":
    case "cta":
      return (
        <div className="rounded-xl bg-white px-4 py-3 text-center text-sm font-medium text-navy-800 shadow-soft">
          {p.title || p.text || "Link"} <Link2 className="ml-1 inline h-3 w-3 text-brand-500" />
        </div>
      );
    case "product":
      return (
        <div className="rounded-xl bg-white px-4 py-3 text-center text-sm font-medium text-navy-800 shadow-soft">
          {p.title || "Product"} {p.price ? <span className="text-brand-600">${p.price}</span> : null}
        </div>
      );
    case "booking":
      return (
        <div className="rounded-xl bg-white px-4 py-3 text-center text-sm font-medium text-navy-800 shadow-soft">
          Book a call
        </div>
      );
    case "social":
      return (
        <div className="flex justify-center gap-3 rounded-2xl bg-white py-3 shadow-soft">
          {["IG", "YT", "X"].map((s) => (
            <span key={s} className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-[10px] font-bold text-navy-600">{s}</span>
          ))}
        </div>
      );
    default:
      return <div className="rounded-xl bg-white p-4 text-xs text-navy-400 shadow-soft">{p.text || "text"}</div>;
  }
}