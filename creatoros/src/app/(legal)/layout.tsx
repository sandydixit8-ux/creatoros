import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader nav={[]} />

      <main className="mx-auto max-w-6xl px-4 py-16">{children}</main>

      <SiteFooter />
    </div>
  );
}
