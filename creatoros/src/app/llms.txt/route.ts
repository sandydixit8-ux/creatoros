import { SITE_URL } from "@/lib/constants";
import { BLOG_POSTS } from "@/lib/blog";

/**
 * /llms.txt — the plain-text map AI crawlers and answer engines ask for.
 * Served from the app itself (there is no `public/` directory), so it ships in
 * every archive without extra packaging steps.
 */

// Prerender at build time: the content only changes when the blog or pricing does.
export const dynamic = "force-static";

const PAGES: [label: string, path: string, description: string][] = [
  ["Pricing", "/pricing", "Plan prices in USD and GBP, tax included, with the free tier"],
  ["All-in-one creator platform", "/all-in-one-creator-platform", "Bio page, store, courses, bookings, email, community in one workspace"],
  ["Sell digital products", "/sell-digital-products", "Selling digital downloads without a marketplace"],
  ["Creator booking", "/creator-booking", "Taking paid bookings and sessions"],
  ["Podcast monetisation", "/podcast-monetization", "Ways podcasts earn beyond ads"],
  ["Coach booking", "/coach-booking", "Booking and payment flow for coaches"],
  ["Linktree alternative", "/linktree-alternative", "For creators outgrowing a link-in-bio page"],
  ["Kajabi alternative", "/kajabi-alternative", "For creators outgrowing Kajabi"],
  [
    "Etsy fee calculator",
    "/etsy-fee-calculator",
    "Free UK/US calculator: what a seller keeps after listing, transaction, processing and VAT on fees",
  ],
  ["Blog", "/blog", "All guides"],
];

export function GET() {
  const pages = PAGES.map(([label, path, description]) => `- [${label}](${SITE_URL}${path}): ${description}`).join("\n");
  const posts = BLOG_POSTS.slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug}): ${p.description}`)
    .join("\n");

  const body = `# CreatorOS

> CreatorOS is an all-in-one platform for creators: a bio page, a digital store, courses, bookings, email campaigns, a community, analytics, a leads CRM and an AI strategy coach. Built for UK and US creators who sell digital products and services. Prices include applicable taxes: Starter $9/£7, Creator $19/£15, Pro $49/£39, Business $99/£79 per month, with a free tier.

Important:
- Prices on the site are the amounts charged at checkout (tax-inclusive). UK visitors see GBP, everyone else USD.
- Indian customers are billed in INR through a separate provider; the GBP/USD prices above do not apply to them.
- The Etsy fee calculator is free and needs no account.

## Product
${pages}

## Guides
${posts}

## Company
- [Contact](${SITE_URL}/contact): support@usecreatoros.co
- [Refund policy](${SITE_URL}/refund-policy): 14-day refund window
- [Terms](${SITE_URL}/terms)
- [Privacy](${SITE_URL}/privacy)

## Optional
- [Sitemap](${SITE_URL}/sitemap.xml)
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
