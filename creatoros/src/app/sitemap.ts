import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { BLOG_POSTS } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // Legal/contact pages are noindex drafts pending counsel review; they must
  // not be advertised here.
  const posts: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${SITE_URL}/all-in-one-creator-platform`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/linktree-alternative`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/kajabi-alternative`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/sell-digital-products`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/creator-booking`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/podcast-monetization`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/coach-booking`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      // Free tool, deliberately above the blog: it is the page most likely to
      // earn links, and it feeds the UK fee posts.
      url: `${SITE_URL}/etsy-fee-calculator`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...posts,
  ];
}