import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBioPage } from "@/lib/bio/page";
import { PublicBioPageView } from "@/components/bio/public-view";
import { trackPublicView } from "@/lib/bio/track";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const bio = getPublicBioPage(username, slug);
  if (!bio) return { title: "Not found" };
  const url = `${SITE_URL}/u/${bio.profile.username}/${bio.page.slug}`;
  return {
    title: `${bio.page.title || bio.profile.displayName || bio.profile.username} — CreatorOS`,
    description: bio.profile.bio || `Check out ${bio.profile.displayName}`,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      title: bio.page.title || bio.profile.displayName || bio.profile.username,
      description: bio.profile.bio || undefined,
      images: bio.profile.avatarUrl ? [bio.profile.avatarUrl] : undefined,
    },
    twitter: {
      card: "summary",
      title: bio.page.title || bio.profile.displayName || bio.profile.username,
      description: bio.profile.bio || undefined,
    },
  };
}

export default async function PublicBioSlugPage({ params }: Props) {
  const { username, slug } = await params;
  const bio = getPublicBioPage(username, slug);
  if (!bio || bio.page.published !== 1) notFound();

  await trackPublicView(bio);

  return <PublicBioPageView bio={bio} />;
}
