export interface PlanLimits {
  bioPages: number;
  links: number;
  contacts: number;
  services: number;
  products: number;
  courses: number;
  viewsPerMonth: number;
  aiCredits: number;
  emailsPerMonth: number;
  customDomain: boolean;
  emailAutomation: boolean;
}

export const PLANS: Record<string, PlanLimits> = {
  free: { bioPages: 1, links: 5, contacts: 10, services: 1, products: 5, courses: 1, viewsPerMonth: 1000, aiCredits: 10, emailsPerMonth: 100, customDomain: false, emailAutomation: false },
  starter: { bioPages: 1, links: 25, contacts: 500, services: 3, products: 25, courses: 3, viewsPerMonth: 10000, aiCredits: 50, emailsPerMonth: 1000, customDomain: false, emailAutomation: false },
  creator: { bioPages: 3, links: 100, contacts: 2000, services: 10, products: 100, courses: 10, viewsPerMonth: 50000, aiCredits: 200, emailsPerMonth: 5000, customDomain: true, emailAutomation: true },
  pro: { bioPages: 10, links: -1, contacts: 10000, services: -1, products: -1, courses: 50, viewsPerMonth: 250000, aiCredits: 800, emailsPerMonth: 20000, customDomain: true, emailAutomation: true },
  business: { bioPages: -1, links: -1, contacts: -1, services: -1, products: -1, courses: -1, viewsPerMonth: -1, aiCredits: -1, emailsPerMonth: -1, customDomain: true, emailAutomation: true },
};

export function getLimits(plan: string): PlanLimits {
  return PLANS[plan] ?? PLANS.free;
}

/**
 * Upgrade order. `PLANS` is declared ascending, so declaration order *is* the
 * ranking - used when a tenant has more than one live subscription and we must
 * pick which one grants access.
 */
const PLAN_RANK: ReadonlyMap<string, number> = new Map(Object.keys(PLANS).map((plan, i) => [plan, i]));

export function planRank(plan: string): number {
  return PLAN_RANK.get(plan) ?? 0;
}

export function usageKey(metric: string): string {
  return metric;
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function withinLimit(used: number, limit: number): boolean {
  return limit === -1 || used < limit;
}

export const PLAN_PRICES: Record<string, { usd: number; inr: number }> = {
  free: { usd: 0, inr: 0 },
  starter: { usd: 9, inr: 749 },
  creator: { usd: 19, inr: 1599 },
  pro: { usd: 49, inr: 3499 },
  business: { usd: 99, inr: 7499 },
};