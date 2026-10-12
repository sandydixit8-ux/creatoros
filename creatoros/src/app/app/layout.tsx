import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { isVerifiedPlatformAdmin } from "@/lib/admin/access";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div className="flex min-h-screen bg-navy-50/50">
      <Sidebar orgName={session.org.name} plan={session.org.plan} isAdmin={isVerifiedPlatformAdmin(session.user)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav userName={session.user.name} orgName={session.org.name} plan={session.org.plan} isAdmin={isVerifiedPlatformAdmin(session.user)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}