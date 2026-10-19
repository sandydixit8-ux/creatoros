import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/constants";
import { PLAN_META } from "@/lib/plans-meta";
import { ConsentBanner } from "@/components/consent/consent-banner";
import { SiteViewBeacon } from "@/components/site/site-view-beacon";
import { ThirdPartyTags } from "@/components/analytics/third-party-tags";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "optional" });

const description =
  "The all-in-one creator & business monetization operating system: link-in-bio store, booking, courses, analytics, AI growth coach, email and more.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CreatorOS — Create. Grow. Sell. Automate. All in One Place.",
    template: "%s | CreatorOS",
  },
  description,
  applicationName: "CreatorOS",
  keywords: [
    "CreatorOS",
    "creator platform",
    "creator economy",
    "creator monetization",
    "content creation",
    "creator analytics",
    "creator storefront",
    "link in bio",
    "digital products",
    "online business tools",
  ],
  authors: [{ name: "CreatorOS", url: SITE_URL }],
  creator: "CreatorOS",
  publisher: "CreatorOS",
  category: "business",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CreatorOS",
    locale: "en_US",
    title: "CreatorOS — Create. Grow. Sell. Automate.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "CreatorOS — Create. Grow. Sell. Automate.",
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#7C3AED",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "CreatorOS",
      url: SITE_URL,
      logo: `${SITE_URL}/icon`,
      description,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "CreatorOS",
      description,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      name: "CreatorOS",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description,
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "99",
        priceCurrency: "USD",
        offerCount: String(PLAN_META.length),
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Above the page content, and in normal flow, so the consent prompt is
            immediately visible without ever covering an interactive control. */}
        <ConsentBanner />
        {/* First-party marketing-site page views for the platform admin dashboard. */}
        <SiteViewBeacon />
        {/* Consent-gated ad tags (Google Ads / Meta pixel). No-ops until the
            visitor opts in to analytics and the IDs are configured. */}
        <ThirdPartyTags />
        {children}
      </body>
    </html>
  );
}