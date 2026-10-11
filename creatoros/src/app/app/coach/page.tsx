import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { allUsage } from "@/lib/usage";
import { getLimits } from "@/lib/plans";
import { CoachPanel } from "@/components/coach/panel";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const used = allUsage(s.org.id).aiCredits ?? 0;
  const limit = getLimits(s.org.plan).aiCredits;
  const creditsLeft = limit === -1 ? -1 : Math.max(0, limit - used);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">AI Coach</h1>
        <p className="mt-1 text-sm text-navy-500">Actionable insights from your real data — what to double down on, what to fix.</p>
      </div>
      <CoachPanel initialCredits={creditsLeft} />
    </div>
  );
}