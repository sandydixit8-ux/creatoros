import { NextRequest, NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

// Pragmatic CSP: 'unsafe-inline' is required because Next.js emits inline
// bootstrap scripts (self.__next_f) and inline style attributes. `frame-src`,
// `media-src` and `img-src` allow user-supplied media/video/avatar URLs.
const CSP = [
  "default-src 'self'",
  // Cashfree's checkout is opened by its JS SDK, so sdk.cashfree.com must be
  // scriptable; Cloudflare auto-injects its RUM beacon at
  // static.cloudflareinsights.com. Both were blocked, which left the buy button
  // hanging on the SDK's "Redirecting…" state.
  `script-src 'self' 'unsafe-inline' https://sdk.cashfree.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob: https: http:",
  "frame-src 'self' https: http:",
  // GA4 beacons go to analytics.google.com / www.google.com / stats.g.doubleclick.net.
  // A `*.analytics.google.com` wildcard does NOT match the apex host, so the
  // collect requests were blocked and Realtime stayed empty.
  "connect-src 'self' https://api.stripe.com https://js.stripe.com https://checkout.stripe.com https://sdk.cashfree.com https://api.cashfree.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com https://stats.g.doubleclick.net https://*.doubleclick.net https://*.clarity.ms https://c.bing.com ws: wss:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api.cashfree.com https://sdk.cashfree.com",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

// Requests to these mutation endpoints may legitimately originate cross-site
// (Stripe webhooks, embedded lead-capture/unsubscribe/tracking).
const PUBLIC_MUTATIONS = new Set([
  "/api/webhooks/stripe",
  "/api/leads/capture",
  "/api/email/unsubscribe",
  "/api/track",
  "/api/site-view",
]);

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  // Alias legacy @username URLs (creator.os/@user) to the /u/user routes so
  // old shared links keep working and the public surface matches the canonical form.
  const { pathname } = request.nextUrl;

  // Browsers and link checkers still ask for /favicon.ico even when the page
  // declares /icon, so serve the generated icon there instead of a 404.
  if (pathname === "/favicon.ico") {
    const url = request.nextUrl.clone();
    url.pathname = "/icon";
    return NextResponse.redirect(url, 308);
  }

  if (pathname.startsWith("/@")) {
    const rest = pathname.slice(2) || "";
    let rewritten: string | null = null;
    if (rest.includes("/")) {
      const [username, ...tail] = rest.split("/");
      rewritten = `/u/${username}/${tail.join("/")}`;
    } else if (rest) {
      rewritten = `/u/${rest}`;
    }
    if (rewritten) {
      const url = request.nextUrl.clone();
      url.pathname = rewritten;
      return NextResponse.redirect(url, 301);
    }
  }

  // Pricing pages render the UK price for UK visitors. Cloudflare geolocates
  // every proxied request and stamps `cf-ipcountry`; copy it to our own header
  // so the app never depends on provider-specific names. Absent header (local
  // dev, direct origin probe) means "unknown", which falls back to USD.
  const country = (request.headers.get("cf-ipcountry") || "").trim().toUpperCase();
  const requestHeaders = new Headers(request.headers);
  if (/^[A-Z]{2}$/.test(country)) {
    requestHeaders.set("x-cr-country", country);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-XSS-Protection", "0");
  if (isProd) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  // Cross-site request forgery defense for session-authenticated APIs:
  // reject cross-site mutating calls unless the endpoint is public by design.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const method = request.method.toUpperCase();
    const isPublic = [...PUBLIC_MUTATIONS].some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`));
    const site = request.headers.get("sec-fetch-site");
    if (!isPublic && MUTATING_METHODS.has(method) && site === "cross-site") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return response;
}

export const config = {
  // `favicon.ico` must NOT be excluded here: the redirect to /icon lives in the
  // proxy, and an excluded path never reaches it (it would 404 instead).
  matcher: ["/((?!_next/static|_next/image|public).*)"],
};