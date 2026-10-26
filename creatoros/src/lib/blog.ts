// Zero-dependency blog content. Posts are structured data rendered by the
// /blog routes with plain JSX, so there is no MDX build step or extra package.
// Every post targets a query a US/UK creator actually searches, and links back
// to the most relevant product/landing page.

export type BlogLink = { label: string; href: string };

export type BlogSection = {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
  links?: BlogLink[];
};

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
        links: [
          { label: "Best Platforms to Sell Digital Products in the UK (2026)", href: "/blog/best-platforms-to-sell-digital-products-uk" },
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
        links: [
          { label: "Payhip vs Gumroad vs Beacons vs CreatorOS: Which is Best for UK Creators?", href: "/blog/payhip-vs-gumroad-vs-beacons-vs-creatoros" },
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
  {
    slug: "best-platforms-to-sell-digital-products-uk",
    title: "Best Platforms to Sell Digital Products in the UK (2026)",
    description:
      "Comparing the best platforms for UK creators to sell digital products in 2026. Fees, features, pros & cons, and which one is right for you.",
    date: "2026-11-02",
    readingMinutes: 8,
    tag: "Monetization",
    related: "/sell-digital-products",
    sections: [
      {
        paragraphs: [
          "For UK creators, the choice of platform to sell digital products has never been more important. With marketplace fees rising and creators wanting to own their audience, more people are moving away from marketplaces like Etsy and towards platforms that let them sell from their own store.",
          "This guide compares the top platforms for UK creators in 2026, looking at fees, features, and who each one is best for.",
        ],
      },
      {
        heading: "Top platforms compared",
        paragraphs: [
          "Here's a no-fluff comparison of the platforms UK creators are actually searching for right now.",
        ],
      },
      {
        heading: "Quick comparison",
        paragraphs: [],
        bullets: [
          "CreatorOS (usecreatoros.co) - Free plan available, keep more of your profits, all-in-one (bio, store, courses, bookings, email), fully customisable storefront, ideal for building a business you own",
          "Payhip - Free plan, competitive fees, great for digital downloads, growing in popularity (+700%), less all-in-one than CreatorOS",
          "Gumroad - Free plan, easy to use, popular, but platform fees add up over time and you don't fully own your customer relationships in the same way",
          "Beacons - Freemium, best for link-in-bio, some store support but limited for a full digital product business",
          "Stan Store - Powerful features, mostly paid plans, pricier for beginners",
          "Etsy - Free to start but marketplace model means fees stack up (listing, transaction, payment processing) and you don't own your audience",
        ],
      },
      {
        heading: "Fees breakdown for UK creators",
        paragraphs: [
          "When comparing platforms, look beyond 'free to start'. Factor in transaction fees, payment processing, and what you keep.",
        ],
        bullets: [
          "CreatorOS: Focus on keeping more of your profits with an all-in-one approach (no need for 5+ subscriptions).",
          "Payhip: Transparent pricing, but features can be limited depending on plan.",
          "Gumroad: Simple fee structure, but costs can add up as you scale.",
          "Beacons: Great for free link-in-bio, store features are more limited.",
          "Etsy: Listing fees + transaction fees + payment processing fees can take a significant cut, especially for high-volume sellers.",
        ],
      },
      {
        heading: "Pros and cons",
        paragraphs: [],
        bullets: [
          "CreatorOS Pros: All-in-one, own your audience, no need to stitch tools together, built for creators. Cons: Newer platform (but growing fast).",
          "Payhip Pros: Easy to use, good for downloads, rising fast. Cons: Less all-in-one, fewer business-building tools.",
          "Gumroad Pros: Simple, well-known. Cons: Fees add up, less control over customer relationships.",
          "Beacons Pros: Great free link-in-bio. Cons: Not ideal as a full store for digital products/courses.",
          "Etsy Pros: Built-in discovery. Cons: You don't own your audience, fees stack up, harder to build a brand.",
        ],
      },
      {
        heading: "Which one should you choose?",
        paragraphs: [
          "If you just want to test selling a PDF, Payhip or Gumroad are fine. If you want to build a real creator business you own - with your brand, your audience, your email list, courses, bookings and a store all in one place - CreatorOS is the strongest choice for UK creators in 2026.",
          "The trend is clear: creators are leaving marketplaces like Etsy (-10% search interest) in favour of platforms where they own their customer relationships.",
        ],
        links: [
          { label: "Payhip vs Gumroad vs Beacons vs CreatorOS: Which is Best for UK Creators?", href: "/blog/payhip-vs-gumroad-vs-beacons-vs-creatoros" },
        ],
      },
      {
        heading: "FAQ",
        paragraphs: [],
        bullets: [
          "Where to sell digital products for free? Many platforms offer free plans (CreatorOS, Payhip, Gumroad). Compare fees and what you actually keep.",
          "Is it better to sell on Etsy or my own website? Etsy gives discovery but you don't own your audience or full control. Selling on your own store (like CreatorOS) gives you long-term control and better margins.",
          "Do I need a developer to sell digital products in the UK? No. Modern platforms handle checkout, payments, receipts and delivery for you.",
        ],
      },
    ],
  },
  {
    slug: "payhip-vs-gumroad-vs-beacons-vs-creatoros",
    title: "Payhip vs Gumroad vs Beacons vs CreatorOS: Which is Best for UK Creators?",
    description:
      "Direct comparison of Payhip, Gumroad, Beacons and CreatorOS for UK creators selling digital products. Fees, ownership, features, and which one wins.",
    date: "2026-11-03",
    readingMinutes: 7,
    tag: "Tools",
    related: "/all-in-one-creator-platform",
    sections: [
      {
        paragraphs: [
          "Payhip (+700%), Gumroad (+400%) and Beacons (Breakout) are all seeing massive search growth in the UK as creators look for places to sell digital products. But which one actually helps you build a business you own?",
          "This comparison cuts through the hype and focuses on what matters: fees, customer ownership, and building beyond just a single product.",
        ],
      },
      {
        heading: "Head-to-head comparison",
        paragraphs: [],
        bullets: [
          "CreatorOS: All-in-one platform (bio page, store, courses, bookings, email, analytics). You own your brand and audience. Keep more of your profits. Best for building a long-term creator business.",
          "Payhip: Great for digital downloads, simple setup, growing fast. Good for selling files, but less comprehensive for courses, bookings, or building a full business stack.",
          "Gumroad: Very easy to use and well-known. Great for getting started, but fees add up and it's more of a store than a full business platform.",
          "Beacons: Best-in-class link-in-bio. Some monetisation features exist, but it's not primarily built for selling digital products/courses at scale.",
        ],
      },
      {
        heading: "Fees & who keeps more",
        paragraphs: [
          "For UK creators, every pound matters. The key question: after platform fees and payment processing, how much do you actually keep?",
        ],
        bullets: [
          "CreatorOS: Designed to help you keep more by replacing multiple tools (link-in-bio, store, course platform, scheduler, email tool) with one platform.",
          "Payhip: Competitive, but you'll need other tools as you grow.",
          "Gumroad: Simple fees, but they add up over time.",
          "Beacons: Mostly link-in-bio focused; monetisation features may have different fee structures.",
        ],
      },
      {
        heading: "Customer ownership & email list",
        paragraphs: [
          "This is the big one. If you don't own your customer relationships, you're building on rented land.",
        ],
        bullets: [
          "CreatorOS: Own your audience, build your email list, capture leads from bio, store and bookings all in one place.",
          "Payhip: You can collect emails, but it's not as integrated into a full business system.",
          "Gumroad: Customers exist on the platform; building a unified list across everything can be trickier.",
          "Beacons: Primarily a link hub - audience ownership is limited compared to a full platform.",
        ],
      },
      {
        heading: "Which one wins for UK creators?",
        paragraphs: [
          "For most UK creators looking to build a sustainable business: CreatorOS wins on 'owning your business'. If you just need to sell a single PDF this week, Payhip or Gumroad are quick options. If you want to grow from link-in-bio to full creator business (store + courses + bookings + email), CreatorOS is the clearest path.",
        ],
      },
      {
        heading: "Verdict",
        paragraphs: [
          "Payhip and Gumroad are great point solutions. Beacons is great for links. CreatorOS is built to be the one platform where your audience, content and revenue all meet - so you spend less time stitching tools together and more time creating.",
        ],
      },
    ],
  },
  {
    slug: "how-much-does-etsy-take-uk",
    title: "How Much Does Etsy Take From a UK Sale? (2026 Fees Breakdown)",
    description:
      "Exactly what Etsy takes from a UK sale in 2026 - listing fee, transaction fee and payment processing - with a worked example on a £20 digital download.",
    date: "2026-11-04",
    readingMinutes: 7,
    tag: "Monetization",
    related: "/sell-digital-products",
    sections: [
      {
        paragraphs: [
          "You list a digital download at £20. It sells. Then Etsy takes its cut - and it is never just one fee.",
          "Here is the whole picture for UK sellers in 2026, with a worked example you can drop straight into a spreadsheet.",
        ],
      },
      {
        heading: "The three fees every UK sale pays",
        paragraphs: [
          "Etsy stacks three charges on the same order. Most sellers only quote the middle one, which is why their margin estimates come out too high.",
        ],
        bullets: [
          "Listing fee: £0.16 each time a listing is published or renewed. Auto-renew charges it again every four months, whether or not the item sells.",
          "Transaction fee: 6.5% of the item price, plus any shipping and gift wrap you charge.",
          "Payment processing: 4% + £0.20 per order through Etsy Payments in the UK.",
        ],
      },
      {
        heading: "Worked example: a £20 digital download",
        paragraphs: [
          "Take a £20 PDF with no shipping and no ads. Here is what leaves the sale.",
        ],
        bullets: [
          "Listing fee: £0.16",
          "Transaction fee at 6.5%: £1.30",
          "Payment processing at 4% + £0.20: £1.00",
          "Total fees: £2.46, or 12.3% of the sale",
          "You keep: £17.54",
        ],
      },
      {
        heading: "The fixed fees punish cheap products",
        paragraphs: [
          "Run the same maths on a £5 product and the percentage gets much worse: £0.89 in fees, or 17.8%. The listing fee and the £0.20 processing charge do not shrink with your price.",
          "That is why £3 to £5 digital downloads rarely work as a business on a marketplace. Either the price goes up or the volume has to be enormous.",
        ],
      },
      {
        heading: "Fee table at every price point",
        paragraphs: [
          "The percentage you lose depends on the price. Here is the same maths across the range UK digital sellers use most, with no shipping and no ads.",
        ],
        bullets: [
          "£5: £0.89 in fees, you keep £4.11 (17.7%)",
          "£12: £1.62 in fees, you keep £10.38 (13.5%)",
          "£20: £2.46 in fees, you keep £17.54 (12.3%)",
          "£35: £4.04 in fees, you keep £30.96 (11.5%)",
          "£50: £5.61 in fees, you keep £44.39 (11.2%)",
          "£100: £10.86 in fees, you keep £89.14 (10.9%)",
        ],
      },
      {
        heading: "The floor you can never get below",
        paragraphs: [
          "Look at the shape of those numbers: the percentage falls towards 10.5% as the price rises, because only the two fixed fees (£0.16 listing and £0.20 processing) get diluted by a bigger order. The 6.5% and 4% move with the price and never shrink.",
          "That floor is the strongest argument for a £19 product over a £4 one. Four £5 sales earn £16.44 after fees. One £20 sale earns £17.54 from a quarter of the transactions - more money, less admin, fewer support messages.",
        ],
      },
      {
        heading: "What else can take a bite",
        paragraphs: [
          "The three headline fees are not the whole story. These are the extras that surprise sellers at the end of the month.",
        ],
        bullets: [
          "Offsite Ads: 15% of the sale when Etsy advertises your listing and the buyer clicks the ad. It drops to 12% for sellers under the $10,000 threshold, and is optional below that level.",
          "VAT on Etsy's fees: UK sellers pay 20% VAT on the fees themselves. It is reclaimable if you are VAT registered, but it is real cash flow if you are not.",
          "Currency conversion: 2.5% when your listing currency differs from your payout currency.",
          "Refunds: you return the sale price, and payment processing fees are generally not returned to you.",
        ],
      },
      {
        heading: "Why digital sellers feel it more than physical sellers",
        paragraphs: [
          "For a handmade seller, Etsy's discovery is genuine value. Buyers arrive already searching, and the marketplace fee buys access to that demand.",
          "For a digital download the maths is different. The product costs nothing to duplicate, so the only real cost is acquiring the buyer - and on a marketplace you pay to acquire the same buyer again on every repeat purchase.",
          "There is also a structural limit. Etsy's policies restrict how you can use buyer details for marketing outside Etsy, so you cannot build a list you own and email it before your next launch. The audience stays with the marketplace.",
        ],
      },
      {
        heading: "What the same £20 sale costs on your own store",
        paragraphs: [
          "Sell from your own branded page and the only unavoidable fee is your payment processor's. There is no listing fee, no transaction fee and no marketplace commission - just a small percentage plus a fixed amount per transaction.",
          "On a £20 sale that is about £0.50 through Stripe at 1.5% + 20p, or roughly £0.88 through PayPal at 2.9% + 30p. Against £2.46 on Etsy, you keep almost two pounds more per order.",
          "The trade-off is honest: Etsy brings the buyers, your own store does not. You have to bring the traffic yourself through search, social, email and word of mouth. That is the work you are buying back when you skip the marketplace.",
        ],
        bullets: [
          "£20 on Etsy: you keep £17.54",
          "£20 on your own store: you keep about £19.50",
          "Difference: £1.96 per sale, or around £235 a year at ten sales a month",
        ],
        links: [
          { label: "Best Platforms to Sell Digital Products in the UK (2026)", href: "/blog/best-platforms-to-sell-digital-products-uk" },
          { label: "Sell digital products on your own branded store", href: "/sell-digital-products" },
        ],
      },
      {
        heading: "FAQ",
        paragraphs: [
          "These are the questions UK sellers ask most often about Etsy fees.",
        ],
        bullets: [
          "Does Etsy take 6.5% or more? 6.5% is only the transaction fee. Add payment processing at 4% + £0.20 and the fixed listing fee, and a £20 digital sale loses roughly 12%.",
          "Is Etsy cheaper than my own store? For paid discovery, sometimes yes. For repeat sales, bundles and email marketing, your own store keeps far more.",
          "Do the numbers change? Yes. Etsy adjusts fees and thresholds regularly, so check the current UK fee schedule before you price a product. The figures here are for illustration.",
        ],
      },
    ],
  },
  {
    slug: "etsy-alternative-for-uk-creators",
    title: "The Best Etsy Alternative for UK Creators in 2026 (and When to Stay)",
    description:
      "When leaving Etsy actually pays, what you lose when you go, and a 90-day migration plan that does not cost you sales along the way.",
    date: "2026-11-05",
    readingMinutes: 8,
    tag: "Strategy",
    related: "/all-in-one-creator-platform",
    sections: [
      {
        paragraphs: [
          "Every UK creator who sells on Etsy eventually asks the same question: should I move to my own store? The honest answer depends less on fees than on where your buyers come from.",
          "This guide covers when Etsy is still the right call, what you genuinely lose by leaving, and how to migrate without a gap in income.",
        ],
      },
      {
        heading: "When Etsy is still the right answer",
        paragraphs: [
          "Etsy is not a mistake. It is a demand rental, and for some creators that rental is a bargain.",
        ],
        bullets: [
          "You sell physical or handmade goods where browsing and discovery drive the sale.",
          "You are still testing whether anyone wants the product at all.",
          "You want checkout, receipts and buyer protection handled for you from day one.",
          "You have no audience yet and no budget for ads.",
        ],
      },
      {
        heading: "The cost of staying",
        paragraphs: [
          "On a £20 digital sale, Etsy's fees land around 12% once listing, transaction and payment processing are added. On a £5 download it climbs past 17%.",
          "The bigger cost is not the percentage. It is that repeat buyers cost you the full fee every time, and you cannot take the relationship with you. Five years of sales on a marketplace leaves you with a shop, not an audience.",
        ],
        links: [
          { label: "How Much Does Etsy Take From a UK Sale? (2026 Fees Breakdown)", href: "/blog/how-much-does-etsy-take-uk" },
        ],
      },
      {
        heading: "What you actually lose when you leave",
        paragraphs: [
          "Be clear-eyed about this: Etsy sends you buyers. Your own store sends you nothing on day one.",
          "Most sellers who leave without a traffic plan earn less for the first three to six months. The fee saving is real but small compared with the loss of marketplace discovery, and it takes time for search rankings, email and social to fill the gap.",
        ],
      },
      {
        heading: "What you gain",
        paragraphs: [
          "Once traffic is solved, ownership compounds in a way marketplace sales never do.",
        ],
        bullets: [
          "Full margin on every sale, including repeat purchases.",
          "An email list you own and can market to before a launch.",
          "Room for bundles, courses, bookings and subscriptions that a marketplace listing cannot hold.",
          "Your own brand, your own pricing, your own refund policy.",
          "No risk of a suspended account wiping out your entire income overnight.",
        ],
      },
      {
        heading: "Etsy versus your own store after twelve months",
        paragraphs: [
          "Numbers settle this argument faster than opinions. Say you sell 40 digital products a month at £20, which is about £800 in revenue.",
        ],
        bullets: [
          "Etsy at roughly 12% in fees: about £98 a month, or £1,176 a year.",
          "Your own store on a free plan: about £20 a month in processing, or £240 a year.",
          "Difference: about £936 a year, before you count repeat buyers you can email for free.",
        ],
      },
      {
        heading: "The honest counterweight",
        paragraphs: [
          "That £936 is only a saving if you can replace Etsy's discovery. If paid ads, content and outreach cost more than £936 a year to produce the same £800 a month, then Etsy is still doing its job and leaving is a pay cut dressed up as a fee cut.",
          "Run that comparison with your own numbers before you migrate. The question is never are the fees lower, it is what does a buyer cost me on each channel.",
        ],
      },
      {
        heading: "Signs you have outgrown Etsy",
        paragraphs: [
          "Most sellers wait until they are frustrated rather than until they are ready. These are the practical signals.",
        ],
        bullets: [
          "You have repeat customers and no way to email them before a launch.",
          "Most of your traffic already comes from your own social accounts, not Etsy search.",
          "You want to sell a course, a booking or a bundle that a single listing cannot hold.",
          "A fee change or an account suspension would wipe out most of your income.",
          "You have stopped raising prices because the marketplace fee makes each increase feel pointless.",
        ],
      },
      {
        heading: "Three migration mistakes to avoid",
        paragraphs: [
          "The plan below works. These are the ways sellers break it.",
        ],
        bullets: [
          "Closing the Etsy shop before the new store has traffic. Run both for at least 90 days.",
          "Copying the marketplace listing word for word. Your own store needs a page written for search and for trust, with your name and face on it.",
          "Moving every product at once. Migrate the three best sellers, learn what converts, then move the rest.",
        ],
      },
      {
        heading: "A 90-day migration plan that protects sales",
        paragraphs: [
          "The mistake is closing the Etsy shop on day one. Run both channels while you build the thing Etsy cannot give you: your own audience.",
        ],
        bullets: [
          "Days 1 to 30: build the store and move your three best-selling products across. Keep every Etsy listing live.",
          "Days 1 to 90: publish consistently on the platforms where your buyers already are - search-friendly blog posts, short video, Pinterest - and send that traffic to your own store.",
          "Throughout: build an email list from your own store with a free download, then email it before every launch.",
          "Only reduce Etsy once your own store is covering the revenue you would lose, not before.",
        ],
      },
      {
        heading: "One rule that keeps you out of trouble",
        paragraphs: [
          "Do not use Etsy to push buyers into buying elsewhere. Etsy's fee-avoidance policy covers exactly that, and accounts get closed for it.",
          "The compliant route is to build your audience off Etsy - social, search, email - and let buyers find your own store independently. Grow the audience in parallel rather than poaching the marketplace.",
        ],
      },
      {
        heading: "Which platform should you move to",
        paragraphs: [
          "If you only need a checkout for downloads, Payhip and Gumroad are quick and cheap to start. If you want the store, bio page, courses, bookings and email in one place, an all-in-one creator platform saves both subscription cost and the friction of stitching tools together.",
          "CreatorOS is built for that second case: one branded page for your audience, with a store, courses, bookings and email behind it, free to start and no card required.",
        ],
        links: [
          { label: "Payhip vs Gumroad vs Beacons vs CreatorOS: Which is Best for UK Creators?", href: "/blog/payhip-vs-gumroad-vs-beacons-vs-creatoros" },
          { label: "One platform for your whole creator business", href: "/all-in-one-creator-platform" },
        ],
      },
      {
        heading: "Verdict",
        paragraphs: [
          "Stay on Etsy while it is your only source of buyers. Move when you can point to another source - search, email or social - that already sends you sales. Leaving earlier than that is not a fee decision, it is a revenue cut.",
        ],
      },
    ],
  },
  {
    slug: "payhip-vs-gumroad-fees-uk",
    title: "Payhip vs Gumroad Fees: What UK Creators Actually Keep in 2026",
    description:
      "Payhip charges 5% on its free plan, Gumroad charges 10% + 50¢ per sale. Here is what that means on a real £20 sale, and when a monthly plan pays for itself.",
    date: "2026-11-06",
    readingMinutes: 7,
    tag: "Tools",
    related: "/sell-digital-products",
    sections: [
      {
        paragraphs: [
          "Payhip and Gumroad both let you sell a download in an afternoon. Their fee structures, however, are not close - and the gap widens as your revenue grows.",
          "Here are the current numbers, what they cost on a real £20 sale, and the point at which a monthly plan becomes cheaper than a percentage.",
        ],
      },
      {
        heading: "Payhip fees in 2026",
        paragraphs: [
          "Payhip charges a monthly subscription plus a transaction percentage, and payment processing is billed separately by Stripe or PayPal.",
        ],
        bullets: [
          "Free Forever: $0 per month, 5% transaction fee per sale.",
          "Plus: $29 per month, 2% transaction fee per sale.",
          "Pro: $99 per month, no Payhip transaction fee.",
          "On every plan, Stripe or PayPal still take their standard processing rate on top.",
        ],
      },
      {
        heading: "Gumroad fees in 2026",
        paragraphs: [
          "Gumroad has no monthly fee. Instead it takes a flat cut of each sale, and a much larger one when the buyer arrives through Gumroad Discover.",
        ],
        bullets: [
          "Direct sales: 10% + 50¢ per sale.",
          "Sales through Gumroad Discover: 30%.",
          "No monthly subscription and no separate processing fee line to reconcile.",
        ],
      },
      {
        heading: "A £20 sale, side by side",
        paragraphs: [
          "Assume a UK card payment through Stripe at roughly 1.5% + 20p, and a 50¢ Gumroad fixed fee converted at about £0.40. Figures are rounded for readability.",
        ],
        bullets: [
          "Payhip Free: £1.00 Payhip + £0.50 processing = £1.50 (7.5%)",
          "Payhip Plus: £0.40 Payhip + £0.50 processing = £0.90 (4.5%), plus $29 per month",
          "Payhip Pro: £0.00 Payhip + £0.50 processing = £0.50 (2.5%), plus $99 per month",
          "Gumroad: £2.00 Gumroad + £0.40 fixed = £2.40 (12%)",
        ],
      },
      {
        heading: "When the monthly fee pays for itself",
        paragraphs: [
          "Monthly plans only make sense above a revenue line. The maths is simple: divide the subscription by the percentage you save.",
        ],
        bullets: [
          "Payhip Free to Plus: saves 3%, costs $29 per month, so it wins above roughly $967 in monthly sales.",
          "Payhip Plus to Pro: saves 2% for an extra $70 per month, so it wins above roughly $3,500 in monthly sales.",
          "Payhip Free to Pro: saves 5% for $99 per month, so it wins above roughly $1,980 in monthly sales.",
          "Gumroad is the most expensive per sale at any volume, but the cheapest to abandon if a product flops.",
        ],
      },
      {
        heading: "The 30% Discover trap",
        paragraphs: [
          "Gumroad's 30% rate only applies when a buyer finds you through Gumroad Discover - but that is precisely the traffic you cannot generate yourself, so it is the sale you are most likely to need early on.",
        ],
        bullets: [
          "£20 sale direct on Gumroad: £17.60 net after 10% + 50¢.",
          "£20 sale through Discover: £14.00 net after 30%.",
          "£20 sale on Payhip Free: £18.50 net after 5% plus card processing.",
        ],
      },
      {
        heading: "What that means in practice",
        paragraphs: [
          "Thirty per cent is roughly what a marketplace charges. Discover is not a cheap growth channel - it is a marketplace wearing a different brand, and it only becomes worth it while you have no audience of your own.",
          "The moment you can send your own traffic, the same product on Payhip keeps about £4.50 more per £20 sale than Gumroad via Discover. That gap is the reason so many UK creators test on Gumroad and move once they have demand.",
        ],
      },
      {
        heading: "The monthly cost at real revenue levels",
        paragraphs: [
          "Subscriptions only look expensive in isolation. Here is what each option costs at three levels of monthly revenue, assuming a £20 average order value and UK card processing through Stripe at about 1.5% + 20p.",
        ],
        bullets: [
          "£500 a month: Payhip Free £37.50 - Payhip Plus £44.50 - Payhip Pro £88.50 - Gumroad £60",
          "£2,000 a month: Payhip Free £150 - Payhip Plus £112 - Payhip Pro £126 - Gumroad £240",
          "£5,000 a month: Payhip Free £375 - Payhip Plus £247 - Payhip Pro £201 - Gumroad £600",
        ],
      },
      {
        heading: "Two things that stand out",
        paragraphs: [
          "Gumroad is the most expensive option at every revenue level once you are selling steadily, because a flat percentage never rewards volume.",
          "Payhip Plus only beats the free plan above roughly £967 a month in sales, which is exactly the breakeven point calculated earlier in this guide. Below that, paying a subscription to save a percentage is a losing trade - and creators do it all the time because the word Pro sounds faster.",
        ],
      },
      {
        heading: "What neither fee includes",
        paragraphs: [
          "Both platforms sell you a checkout. Neither sells you a business.",
          "A bio page, a course platform, a booking calendar and an email tool are all separate subscriptions once you need them - typically another $30 to $100 per month, and another four logins to keep in sync. That cost usually dwarfs the difference between 5% and 10%.",
          "CreatorOS puts those pieces behind one branded page and one login, free to start, so a single sale does not have to pay for five tools.",
        ],
        links: [
          { label: "Payhip vs Gumroad vs Beacons vs CreatorOS: Which is Best for UK Creators?", href: "/blog/payhip-vs-gumroad-vs-beacons-vs-creatoros" },
          { label: "Best Platforms to Sell Digital Products in the UK (2026)", href: "/blog/best-platforms-to-sell-digital-products-uk" },
          { label: "Compare CreatorOS plans", href: "/pricing" },
        ],
      },
      {
        heading: "Verdict",
        paragraphs: [
          "Under about $1,000 a month in sales, Payhip Free beats Gumroad on fees and Gumroad beats Payhip on simplicity. Above that, Payhip Plus or Pro is clearly cheaper, and Gumroad's 10% starts to look expensive.",
          "If you plan to sell more than downloads - courses, bookings, an email list - the platform fee is the smaller decision. Choose the stack you will not have to rebuild in six months.",
        ],
      },
    ],
  },
  {
    slug: "how-to-sell-digital-products-uk",
    title: "How to Sell Digital Products in the UK (2026 Step-by-Step)",
    description:
      "A practical six-step path for UK creators: what to sell, how to price in pounds, the VAT question, delivery and refunds, and how to get the first ten buyers.",
    date: "2026-11-07",
    readingMinutes: 9,
    tag: "Strategy",
    related: "/sell-digital-products",
    sections: [
      {
        paragraphs: [
          "Selling a digital product in the UK is genuinely simple to start and easy to get wrong in the details - pricing, VAT, delivery, refunds.",
          "This is the whole process, in the order you should do it. Nothing here needs a developer, a designer or an accountant on day one.",
        ],
      },
      {
        heading: "1. Pick something UK buyers already pay for",
        paragraphs: [
          "Your first product should solve one specific problem for one specific person. Broad ebooks sell badly; narrow tools sell well.",
        ],
        bullets: [
          "Templates: invoices, pitch decks, wedding stationery, social media kits.",
          "Spreadsheets and Notion systems: budgeting, freelance tracking, small business bookkeeping.",
          "Presets, fonts and design assets for other creators.",
          "Short practical guides and checklists - under 30 pages, one outcome.",
          "A recorded mini-course if you already teach this thing for free.",
        ],
      },
      {
        heading: "2. Price in pounds and know your fee floor",
        paragraphs: [
          "Price in GBP so UK buyers see the currency they think in, and work out your fees before you set the number - not after.",
          "A £5 product is rarely worth selling once fixed fees land on it. A £19 to £39 product gives you room to absorb fees, run the occasional discount and still make the sale worthwhile.",
        ],
        links: [
          { label: "How to price your first digital product", href: "/blog/how-to-price-a-digital-product" },
        ],
      },
      {
        heading: "Pricing benchmarks for UK digital products",
        paragraphs: [
          "If you have no idea where to start, these ranges reflect what UK creators charge for common formats. Treat them as a starting point, not a rule.",
        ],
        bullets: [
          "Single template or checklist: £7 to £15.",
          "Template pack or system of 5 to 20 files: £19 to £39.",
          "Recorded mini-course: £49 to £99.",
          "Live workshop with a recording: £29 to £79.",
          "Monthly membership: £9 to £29.",
        ],
      },
      {
        heading: "3. Check the VAT question before your first sale",
        paragraphs: [
          "Digital sales have their own VAT rules in the UK, and they are not the same as selling a physical item.",
          "Selling through a marketplace or platform usually means the platform handles VAT as the deemed supplier on those sales. Selling direct to consumers can put the liability on you, and the place-of-supply rules for digital services are stricter than the standard VAT threshold.",
          "This is the one step worth ten minutes with an accountant rather than a blog post. Get it right before you take money, not after. Nothing here is tax advice.",
        ],
      },
      {
        heading: "4. Set up checkout and delivery",
        paragraphs: [
          "Instant delivery is the whole appeal of a digital product, so the buying path has to be short: land on the page, pay, get the file.",
        ],
        bullets: [
          "Use a hosted checkout so you never touch card data.",
          "Deliver the file automatically by email and from an account area, so buyers can re-download.",
          "State the licence clearly: personal use, commercial use, or both.",
          "Write a refund policy that fits digital goods, and remember UK consumers normally have 14 days to cancel - that right can be lost for digital content only with explicit consent and acknowledgement at checkout.",
        ],
      },
      {
        heading: "5. Get the first ten buyers without ads",
        paragraphs: [
          "Ten sales teach you more than a month of planning. None of them need a budget.",
        ],
        bullets: [
          "Answer the question your product solves in public - Reddit, Facebook groups, forums - and link your store only where it is welcome.",
          "Post one short video a day showing the product in use, not the product page.",
          "Write the blog post that matches what buyers search, such as how much Etsy takes from a UK sale.",
          "Email or message the ten people most likely to need it, personally.",
          "Offer a launch price to the first twenty buyers and say so honestly.",
        ],
      },
      {
        heading: "6. Turn buyers into a list you own",
        paragraphs: [
          "The first sale is a transaction. The list is the business. Every buyer and every free-download subscriber should land in the same audience, so your second launch costs nothing to announce.",
          "Keep your store, courses, bookings and email on one platform where possible. Five tools means five exports and a list that never fully matches.",
        ],
        links: [
          { label: "Best Platforms to Sell Digital Products in the UK (2026)", href: "/blog/best-platforms-to-sell-digital-products-uk" },
          { label: "Start selling on CreatorOS", href: "/sell-digital-products" },
        ],
      },
      {
        heading: "A realistic first 90 days",
        paragraphs: [
          "This is the pace that produces sales without an existing audience. It assumes you already have a product and a store link.",
        ],
        bullets: [
          "Week 1: build the product and the page. One product, one checkout link, one email capture.",
          "Week 2: sell to warm contacts - your own followers, past clients, anyone who has asked you about this problem.",
          "Weeks 3 to 4: publish two short videos a week showing the product in use, plus one blog post answering the question it solves.",
          "Weeks 5 to 8: post in three communities a week where the problem is discussed, and add a free lead magnet to grow the list.",
          "Weeks 9 to 12: email the list, run one genuine launch window, then raise the price and keep selling.",
        ],
      },
      {
        heading: "Five mistakes that kill a first launch",
        paragraphs: [
          "None of these are technical. They are the reasons good products sell nothing.",
        ],
        bullets: [
          "Building for months and launching once. Ship something small in the first two weeks.",
          "Hiding the price. Buyers who cannot see it assume it is expensive.",
          "No email capture on the product page. Most visitors will not buy today, and you need a way back to them.",
          "Selling only to strangers. Your first ten buyers are usually people who already know you.",
          "Changing nothing after launch. The first ten sales are research - read the questions buyers ask before they pay.",
        ],
      },
      {
        heading: "FAQ",
        paragraphs: [
          "The three questions that come up before every first launch.",
        ],
        bullets: [
          "Do I need a company to sell digital products in the UK? No. A sole trader can sell from day one, though registering as self-employed with HMRC is required once you are trading.",
          "Can I sell digital products on Etsy? Yes, and Etsy brings buyers - but fees stack up and you do not own the customer relationship.",
          "How much does it cost to start? Under £20 for a domain, plus whatever platform you choose. CreatorOS is free to start with no card required.",
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
