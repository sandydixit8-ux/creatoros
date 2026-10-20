import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getPost, BLOG_POSTS } from "@/lib/blog";
import { SITE_URL } from "@/lib/constants";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not found" };
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "CreatorOS" },
    publisher: { "@type": "Organization", name: "CreatorOS" },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <div className="min-h-screen bg-night-950 text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nav={[]} />

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex items-center gap-3 text-xs font-medium text-ink-muted">
          <Link href="/blog" className="transition-colors hover:text-ink">
            Blog
          </Link>
          <span aria-hidden>·</span>
          <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-brand-300">
            {post.tag}
          </span>
        </div>

        <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-lg text-ink-secondary">{post.description}</p>
        <div className="mt-4 flex items-center gap-3 text-sm text-ink-muted">
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </time>
          <span aria-hidden>·</span>
          <span>{post.readingMinutes} min read</span>
        </div>

        <article className="mt-12 space-y-10">
          {post.sections.map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className="text-xl font-semibold text-ink sm:text-2xl">{section.heading}</h2>
              )}
              {section.paragraphs.map((p, j) => (
                <p key={j} className="mt-4 leading-relaxed text-ink-secondary">
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-4 space-y-2.5">
                  {section.bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-ink-secondary">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <div className="mt-14 rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-600/20 to-cyan-500/10 p-8 text-center">
          <p className="text-lg text-ink">Put it into practice with CreatorOS.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
            One platform for your bio page, store, courses, bookings, email and analytics.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/register" className="btn-primary px-7 py-3 text-base">
              Start for Free <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={post.related}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-base font-medium text-ink transition-colors hover:bg-white/10"
            >
              Learn more
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
