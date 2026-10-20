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
  {
    slug: "how-to-monetize-a-podcast",
    title: "How to monetize a podcast without waiting for a sponsor",
    description:
      "Sponsors are one income stream, not the only one. Here is how podcasters turn listeners into buyers with memberships, products, bookings and a list they own.",
    date: "2026-10-26",
    readingMinutes: 6,
    tag: "Monetization",
    related: "/podcast-monetization",
    sections: [
      {
        paragraphs: [
          "Most podcasters chase sponsors first and wait months for a deal that pays less than they hoped. The faster path is to sell something directly to the listeners you already have.",
          "Your audience is warmed up by your voice every episode. That trust converts far better than a cold ad — you just need somewhere to send them.",
        ],
      },
      {
        heading: "The income streams that do not need a sponsor",
        paragraphs: [],
        bullets: [
          "A membership or paid bonus feed for superfans",
          "Digital products: transcripts, guides, presets, templates",
          "A course built from your best episodes",
          "Paid booking for coaching or consulting calls",
          "Affiliate links for the gear and tools you already mention",
        ],
      },
      {
        heading: "Give every episode a destination",
        paragraphs: [
          "A shout-out with no link is a dead end. Send listeners to one page where they can subscribe, buy, book or join your list — and say it out loud in the episode and in the show notes.",
          "That single destination should carry your brand, not a marketplace that keeps the customer relationship for itself.",
        ],
      },
      {
        heading: "Own the list, not just the feed",
        paragraphs: [
          "Algorithms and platforms change; your email list does not. Offer a free download or bonus episode in exchange for an email, then sell to that list when you launch.",
        ],
      },
      {
        heading: "Measure what pays",
        paragraphs: [
          "Track which episode, which link and which call to action actually produced revenue. Double down on the format that converts instead of guessing.",
        ],
      },
    ],
  },
  {
    slug: "how-to-take-bookings-as-a-coach",
    title: "How to take bookings as a coach or consultant",
    description:
      "A simple system for coaches to show availability, take paid bookings and follow up — without juggling a scheduler, a payment link and a spreadsheet.",
    date: "2026-10-28",
    readingMinutes: 5,
    tag: "Services",
    related: "/coach-booking",
    sections: [
      {
        paragraphs: [
          "Coaches lose bookings in the gap between wanting a session and paying for one. Every extra step — a form, a separate payment link, a back-and-forth email — is a place a client drops off.",
          "The fix is to make booking and paying the same action, on a page that already has your credibility on it.",
        ],
      },
      {
        heading: "What a booking flow needs",
        paragraphs: [],
        bullets: [
          "Your availability, shown honestly and in the client's time zone",
          "Payment taken at the moment of booking, not after",
          "A confirmation and reminder that sends itself",
          "A record of who booked, what they paid and what is next",
        ],
      },
      {
        heading: "Put bookings next to everything else",
        paragraphs: [
          "Clients often discover you through a product, a podcast or social, then decide to book. If booking lives on a separate tool, you split that journey in two.",
          "Keep your bio page, products and bookings together so a follower can move from free to paid without leaving your brand.",
        ],
      },
      {
        heading: "Reduce no-shows",
        paragraphs: [
          "Taking payment up front, sending a reminder and asking for a short intake note all raise show-up rates. A paid booking is a committed booking.",
        ],
      },
      {
        heading: "Turn one session into a relationship",
        paragraphs: [
          "After the call, invite the client onto your email list and point them to the next step — a package, a course or a recurring slot. Bookings are the start of revenue, not the end.",
        ],
      },
    ],
  },
  {
    slug: "build-an-email-list-you-own",
    title: "How to build an email list you actually own",
    description:
      "Social followers are rented; an email list is owned. Here is how creators capture leads from their bio page, store and bookings — and keep them in one place.",
    date: "2026-10-30",
    readingMinutes: 5,
    tag: "Audience",
    related: "/linktree-alternative",
    sections: [
      {
        paragraphs: [
          "A follower on a social platform can disappear with a policy change or a bad month in the algorithm. An email list is the one audience asset you control.",
          "The good news is you do not need a separate email tool bolted onto three others — you need to capture the emails your audience already wants to give you.",
        ],
      },
      {
        heading: "Give people a reason to subscribe",
        paragraphs: [],
        bullets: [
          "A lead magnet: a checklist, a template, a mini-guide",
          "Early access to a product or a new episode",
          "A discount on their first purchase",
          "A heads-up when bookings open",
        ],
      },
      {
        heading: "Capture everywhere your audience is",
        paragraphs: [
          "Your bio page, your store checkout and your booking form are all natural points to grow the list. Someone who already bought or booked is the warmest subscriber you will ever get.",
          "Collect them into one list rather than scattering contacts across a store tool, a scheduler and a form builder.",
        ],
      },
      {
        heading: "One list beats five exports",
        paragraphs: [
          "When your store, courses, bookings and email share one login, every new buyer and booker joins the same audience. That is what makes the next launch easier than the last.",
        ],
      },
      {
        heading: "Respect the inbox",
        paragraphs: [
          "Send useful, infrequent emails. A small list that trusts you will out-earn a big list that ignores you every time.",
        ],
      },
    ],
  },
  {
    slug: "how-to-price-a-digital-product",
    title: "How to price your first digital product",
    description:
      "Pricing a digital product feels like guesswork. Here is a simple framework for setting, testing and raising prices as a creator without leaving money on the table.",
    date: "2026-11-01",
    readingMinutes: 5,
    tag: "Monetization",
    related: "/sell-digital-products",
    sections: [
      {
        paragraphs: [
          "The most common pricing mistake is not charging too much — it is charging too little and never testing. A price you can change is a hypothesis; a price you never touch is a guess.",
          "Here is how to set a first price, then let real buyers tell you what to do next.",
        ],
      },
      {
        heading: "Start from the outcome, not the effort",
        paragraphs: [
          "Buyers pay for a result, not for how long you spent making the file. A one-page template that saves a freelancer five hours is worth more than a 40-page ebook that saves them nothing.",
        ],
      },
      {
        heading: "Use tiers when you can",
        paragraphs: [],
        bullets: [
          "Entry price: removes hesitation, gets you testimonials",
          "Standard price: your main offer once proof exists",
          "Premium price: adds coaching, a template pack or a community",
        ],
      },
      {
        heading: "Test in steps, not leaps",
        paragraphs: [
          "Raise the price by a modest amount and watch conversion. If sales hold, raise again. If they collapse, you found your ceiling — and you still learned something useful.",
        ],
      },
      {
        heading: "Watch which channel converts",
        paragraphs: [
          "The same product can sell at different rates from a podcast, an email and social. First-party analytics tell you where a price works and where the audience is simply wrong for it.",
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
