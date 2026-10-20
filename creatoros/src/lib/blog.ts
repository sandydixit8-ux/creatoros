// Zero-dependency blog content. Posts are structured data rendered by the
// /blog routes with plain JSX, so there is no MDX build step or extra package.
// Every post targets a query a US/UK creator actually searches, and links back
// to the most relevant product/landing page.

export type BlogSection = { heading?: string; paragraphs: string[]; bullets?: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO date
  readingMinutes: number;
  tag: string;
  related: string;
  sections: BlogSection[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "link-in-bio-vs-creator-os",
    title: "Link-in-bio vs a full creator platform: what actually grows your business",
    description:
      "A link-in-bio page gets people to your links. A creator platform gets them to pay, book and subscribe. Here is how to decide what you really need.",
    date: "2026-10-20",
    readingMinutes: 5,
    tag: "Strategy",
    related: "/linktree-alternative",
    sections: [
      {
        paragraphs: [
          "Most creators start with a link-in-bio because it is the fastest way to point an audience somewhere. It works — until you need that audience to do something more than tap a link.",
          "The moment you sell a product, run a course, take bookings or build an email list, a link-in-bio tool becomes a bottleneck. You end up stitching three or four services together and losing track of what actually converts.",
        ],
      },
      {
        heading: "What a link-in-bio is good at",
        paragraphs: [],
        bullets: [
          "One tidy page that holds all your links",
          "A simple, familiar destination for social bios",
          "Very fast to set up and free to start",
        ],
      },
      {
        heading: "Where it runs out of road",
        paragraphs: [],
        bullets: [
          "Selling digital products usually needs a separate store tool",
          "Courses, bookings and email are not included",
          "Analytics stop at clicks — they cannot tell you what made money",
          "Leads live in someone else's tool, not your list",
        ],
      },
      {
        heading: "What to look for instead",
        paragraphs: [
          "If you are earning — or plan to — look for a platform where the bio page, store, courses, bookings, email and analytics are the same product with the same login. That is the difference between a link hub and a business.",
          "You should not have to pay for five subscriptions to run one creator business, and you especially should not have to give up ownership of your audience to do it.",
        ],
      },
      {
        heading: "The practical test",
        paragraphs: [
          "Ask one question: can a follower go from your page to paying you, booking you and joining your list without leaving your brand? If the answer is no, you have outgrown a link-in-bio tool.",
        ],
      },
    ],
  },
  {
    slug: "how-to-sell-digital-products-without-a-developer",
    title: "How to sell digital products without a developer",
    description:
      "A step-by-step path to listing, pricing and selling your first digital product as a creator — with the tools that handle checkout, receipts and delivery for you.",
    date: "2026-10-22",
    readingMinutes: 6,
    tag: "Monetization",
    related: "/sell-digital-products",
    sections: [
      {
        paragraphs: [
          "Selling a digital product is one of the fastest ways for a creator to earn. The good news: you do not need a developer, a designer or a checkout built from scratch.",
          "Here is the whole job, in order, and what you actually need at each step.",
        ],
      },
      {
        heading: "1. Pick something small and specific",
        paragraphs: [
          "Your first product should solve one problem for one person. A template, a checklist, a presets pack, a short guide. Small products ship faster and tell you what your audience will pay for.",
        ],
      },
      {
        heading: "2. Choose a store that already handles payments",
        paragraphs: [
          "You want a hosted store with secure checkout and automatic receipts, so you never touch card data and every buyer gets proof of purchase. Look for one that lives on your own branded page, not buried in a marketplace.",
        ],
      },
      {
        heading: "3. Price it so it can grow",
        paragraphs: [
          "Start low enough to remove hesitation — often under $20 — and raise it once you have testimonials. You can always create a bigger product later; you cannot un-launch a price you never tested.",
        ],
      },
      {
        heading: "4. Share one link everywhere",
        paragraphs: [
          "Send every channel to a single bio page where people can browse and buy. Fewer links means fewer places for a buyer to get lost.",
        ],
      },
      {
        heading: "5. Watch what sells, then double down",
        paragraphs: [
          "Use first-party analytics to see which traffic source and which product actually convert. Then make more of the thing that worked.",
        ],
      },
    ],
  },
  {
    slug: "creator-tool-stack-2026",
    title: "The 2026 creator tool stack: what you actually need (and what you can drop)",
    description:
      "Creators are paying for more tools than they use. Here is a lean 2026 stack that covers bio, store, courses, bookings, email and analytics without the bloat.",
    date: "2026-10-24",
    readingMinutes: 5,
    tag: "Tools",
    related: "/all-in-one-creator-platform",
    sections: [
      {
        paragraphs: [
          "The average creator pays for a link-in-bio tool, a store, a course platform, a scheduler, an email tool and an analytics dashboard — and still has no idea which channel makes money.",
          "You do not need six logins. You need one place where the audience, the content and the revenue meet.",
        ],
      },
      {
        heading: "What to keep",
        paragraphs: [],
        bullets: [
          "One bio page that is your home base",
          "One store with checkout and receipts",
          "One course and booking system for services",
          "One email list you own",
          "One analytics view across all of it",
        ],
      },
      {
        heading: "What to drop",
        paragraphs: [],
        bullets: [
          "Duplicate schedulers that each cost a subscription",
          "Marketplace-only stores that keep your customer data",
          "Analytics tools that stop at clicks and never reach revenue",
        ],
      },
      {
        heading: "The rule that keeps the stack small",
        paragraphs: [
          "Everything should share one login, one brand and one source of truth for leads and revenue. If a tool cannot pass data to the next, it is creating work instead of removing it.",
        ],
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function sortedPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}
