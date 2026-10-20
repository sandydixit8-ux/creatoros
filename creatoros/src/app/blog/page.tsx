import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { sortedPosts } from "@/lib/blog";

export const metadata = {
  title: "Blog — Grow and Sell as a Creator",
  description:
    "Practical guides for creators, coaches and consultants: how to grow an audience, sell digital products, take bookings and choose the right tools in 2026.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = sortedPosts();

  return (
    <div className="min-h-screen bg-night-950 text-ink">
      <SiteHeader nav={[]} />

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[110px]" />
          </div>
          <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-ink-secondary">
              CreatorOS blog
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Grow, sell and scale as a creator
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              Practical, no-fluff guides on building an audience, monetizing it and running your creator business from
              one place.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <ul className="grid gap-6">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block rounded-2xl border border-white/10 bg-night-800/60 p-7 transition-colors hover:border-brand-500/40"
                >
                  <div className="flex items-center gap-3 text-xs font-medium text-ink-muted">
                    <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-brand-300">
                      {post.tag}
                    </span>
                    <time dateTime={post.date}>{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
                    <span aria-hidden>·</span>
                    <span>{post.readingMinutes} min read</span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-ink group-hover:text-brand-300">{post.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{post.description}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-300">
                    Read the guide <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-14 rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-600/20 to-cyan-500/10 p-8 text-center">
            <p className="text-lg text-ink">Ready to put this into practice?</p>
            <Link href="/auth/register" className="btn-primary mt-5 inline-flex px-7 py-3 text-base">
              Start free — no card required <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
