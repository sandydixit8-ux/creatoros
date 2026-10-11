# CreatorOS — Premium Redesign Audit & Issue Register

**Author:** CreatorOS product/engineering team (automated audit pass)
**Date:** 11 October 2026
**Checkpoint:** git tag `pre-redesign-20261011` (= `e94b303`, pushed to `github-new main`)
**Scope:** Full repo (`creatoros/`) + live `https://usecreatoros.co`. Marketing public surface, authenticated dashboard (all 9 modules), design system, SEO, a11y, security.
**Baseline quality (recorded this session, same checkpoint):** unit **328/328**, E2E **34/34**, `eslint` clean, `tsc --noEmit` clean, prod `npm audit --omit=dev` **0 vulns** (next 16.4.0). BUILD_ID `gyG9buvN9lnDYg3gGYidG` live.

---

## 1. Headline findings

1. **No design-system layer.** The whole app is 8 CSS classes in `globals.css` + raw Tailwind utilities inline in 40 components. `clsx`, `class-variance-authority`, `tailwind-merge` are installed but **never imported**. Colors drift into hardcoded hex in charts, coach panel, OG images, manifest.
2. **Marketing site is minimal** (112-line homepage: header/hero(2 CTAs + inert mockup)/5 features/5 pricing cards/footer). No FAQ, no modules walkthrough, no demo, no mobile nav. "Explore demo" → `/auth/login`. "Nine modules" claim but only 5 cards rendered.
3. **Dashboard has no mobile navigation.** Sidebar is `hidden … lg:flex`; there is **no** drawer/hamburger — on phones there is no way to reach any module except bell/logout.
4. **Systemic accessibility gaps.** Zero `aria-live`/`role=alert`, zero `aria-current`/`expanded`/`controls`/`pressed`, only 7 `htmlFor`, 5 tables without `caption`/`scope`, no `loading.tsx`/`error.tsx`/`not-found.tsx` anywhere.
5. **SEO defect:** root layout forces `canonical: "/"` and generic OG on every subpage (confirmed live on `/pricing`); JSON-LD `offerCount: "3"` vs 5 plans; `/pricing` title renders double brand.
6. **Legal placeholders live publicly:** `[Registered legal entity name]` etc. + amber "Draft pending legal review" on `/terms /privacy /refund-policy /cookie-policy /contact`. Blocked pending counsel-approved copy.
7. **Security (from VAPT-REPORT.md):** no critical; H1/H3/H4 fixed+deployed. Open low/info items: `x-powered-by`, CSP `'unsafe-inline'`/http sources, duplicate CSP header.
8. **Identity conflict:** brand tokens are **indigo** (`#4f46e5`); required design language is **violet + dark navy + cyan**.

No P0 (data-loss/exploit) findings. P1 items below are usability/a11y/SEO/legal, not downtime.

## 2. Issue register (P0–P3)

| ID | Sev | Area | Finding | Fix phase |
|---|---|---|---|---|
| U-01 | P1 | Marketing | "Explore demo" CTA → `/auth/login`; hero mockup inert; no demo surface | 3 |
| U-02 | P1 | Dashboard | Sidebar hidden `<lg`, no mobile nav anywhere | 4 |
| U-03 | P1 | Platform | No `loading.tsx`/`error.tsx`/`not-found.tsx`/`global-error.tsx` in app | 4/5 |
| A-01 | P1 | A11y | Forms without associated labels (leads search, booking manager, public booking, courses, community) — 7 `htmlFor` total | 5 |
| A-02 | P1 | A11y | No `aria-live`/`role="alert"` for async feedback (toasts, coach errors, form results) | 5 |
| A-03 | P1 | A11y | No `aria-current`/`aria-expanded`/`aria-controls`/`aria-pressed` anywhere (nav active, accordions, tabs, toggles, day/slot buttons) | 5 |
| A-04 | P1 | A11y | All 5 tables lack `caption`+`scope`; charts lack accessible names (DonutChart, SourcesExplorer) and data-table fallback | 5 |
| L-01 | P1 | Legal | Bracket placeholders + draft banner live; needs counsel-approved entity info (blocked) | blocked |
| S-01 | P1 | SEO | Canonical + og:url forced to `/` on subpages; JSON-LD `offerCount:"3"` (5 plans) | 5 |
| C-01 | P1 | Copy | "Nine modules" vs 5 cards; keyword "social media scheduling" (no module); "Priority support" (no backend flag); pricing duplicated in 3 files | 3 |
| U-04 | P2 | AI Coach | Credit balance hidden until first run; **no AI-provenance disclaimer** | 4/5 |
| U-05 | P2 | Store/Booking | `window.confirm`/`alert()` blocking dialogs | 4 |
| U-06 | P2 | Platform | Plain-text "Loading…" everywhere; no skeletons | 4 |
| U-07 | P2 | Analytics | Hand-rolled SVG charts, hardcoded hex, no legend/data-table, no drill-through | 5 |
| T-01 | P2 | Design | Hardcoded colors bypass tokens; no primitive components; installed libs unused | 3 |
| T-02 | P2 | Type | Single Inter at few sizes; marketing hero/body same scale; no tabular numerals | 3 |
| P-01 | P3 | Security | `x-powered-by: Next.js` exposed (VAPT L1) | 5 |
| P-02 | P3 | Security | Duplicate `Content-Security-Policy` headers (VAPT I1) | 5 |
| P-03 | P3 | SEO | Sitemap omits legal/contact; auth pages indexable | 5 |
| P-04 | P3 | A11y | Bio editor drag-reorder has no keyboard path | 5 |
| P-05 | P3 | Perf | Notification bell polls every 30s even when tab hidden | 4 |
| P-06 | P3 | Copy | `summary-cards.tsx` "summar" -typed export observed; minor copy nits | 3 |

## 3. Design token specification (new)

Replaces the indigo `brand-*` ramp with violet, keeps `navy-*` for light app surfaces, adds `night-*` for the dark marketing/system palette, per the master design language.

### Brand — violet
| Token | Value |
|---|---|
| brand-50 | #F5F3FF |
| brand-100 | #EDE9FE |
| brand-200 | #DDD6FE |
| brand-300 | #C4B5FD |
| brand-400 | #A78BFA |
| brand-500 | #8B5CF6 (primary violet) |
| brand-600 | #7C3AED (hover violet) |
| brand-700 | #6D28D9 |
| brand-800 | #5B21B6 |
| brand-900 | #4C1D95 |

### Dark (night) surfaces
| Token | Value | Use |
|---|---|---|
| night-950 | #0B1020 | main background |
| night-900 | #10172A | secondary background |
| night-800 | #171E35 | elevated surface |
| night-700 | #202943 | interactive surface |
| night-600 | #29344D | borders |
| night-500 | #33405F | border-light / hairline |
| night-400 | #56648A | muted border-text |

### Text on dark
| Token | Value | Use |
|---|---|---|
| ink-primary | #F8FAFC | headings / primary text |
| ink-secondary | #A8B3C7 | body text |
| ink-muted | #7F8AA3 | captions / meta |

### Accents (built-in Tailwind, referenced as tokens)
cyan #22D3EE (data/highlight), blue #60A5FA (info), emerald #34D399 (success), amber #FBBF24 (warning), red/rose #F87171 (error).

### Light surfaces (app dashboard stays light, harmonized)
bg #F8FAFC · card #FFFFFF · text #0F172A · secondary #475569 · borders #E2E8F0 · accent #7C3AED.

**Rules:** status never by color alone; validate contrast to WCAG 2.2 AA; gradients subtle; tokens in `globals.css` `@theme` only.

## 4. Phase plan (execution)

1. **P1 done.** Repo discovery, baseline tests, checkpoint tag.
2. **P2 this doc.** Findings + registers + tokens spec.
3. **P3 homepage redesign + reusable marketing shell + tokens landed in code.**
4. **P4 dashboard UX** (mobile nav, shells, quotas, dialogs, skeletons).
5. **P5 a11y/perf/SEO/security hardening.**
6. **P6 tests** (marketing, a11y, regression) + verify all green.
7. **P7 staging/deploy doc, rollback, final scorecard.**

## 5. Baseline quality record

| Check | Result | Evidence |
|---|---|---|
| Unit tests | 328/328 | `npm test` (vitest) |
| E2E | 34/34 | `npm run test:e2e` (Playwright, isolated db) |
| Lint | clean | `npm run lint` |
| Typecheck | clean | `tsc --noEmit` |
| Prod audit | 0 vulns | `npm audit --omit=dev` |
| Live | 200 / db ok | `/api/health`, EPROTO 0, BUILD_ID `gyG9buvN9lnDYg3gGYidG` |
| Lab CWV | not yet measured | Phase 5 will record Lighthouse lab numbers |