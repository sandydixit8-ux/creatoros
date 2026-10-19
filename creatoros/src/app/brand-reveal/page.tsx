import { BrandReveal } from "@/components/marketing/brand-reveal";

export const metadata = {
  title: "Brand reveal — CreatorOS",
  robots: { index: false, follow: false },
};

export default function BrandRevealPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#05070f] p-5">
      <BrandReveal className="max-w-[1600px]" />
    </main>
  );
}
