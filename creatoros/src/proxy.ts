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
  `script-src 'self' 'unsafe-inline' https://sdk.cashfree.com https://static.cloudflareinsights.com${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob: https: http:",
  "frame-src 'self' https: http:",
  "connect-src 'self' https://api.stripe.com https://js.stripe.com https://checkout.stripe.com https://sdk.cashfree.com https://api.cashfree.com ws: wss:",
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
]);

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  // Alias legacy @username URLs (creator.os/@user) to the /u/user routes so
  // old shared links keep working and the public surface matches the canonical form.
  const { pathname } = request.nextUrl;
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

  const response = NextResponse.next();
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};