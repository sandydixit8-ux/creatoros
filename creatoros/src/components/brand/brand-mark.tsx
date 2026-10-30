import Image from "next/image";
import logo from "@/assets/brand/logo-mark.webp";

/**
 * The CreatorOS mark, from one source asset so the header, footer, sidebar and
 * auth screens cannot drift apart.
 *
 * The artwork is full-bleed (no transparency), so it is clipped to a rounded
 * square instead of being floated as a transparent glyph. `unoptimized` keeps
 * the 5 KB webp as-is: it is already small, and the app must not depend on the
 * image optimizer being available in the standalone server.
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt=""
      width={128}
      height={128}
      unoptimized
      priority
      aria-hidden
      className={`${className} shrink-0 rounded-lg object-cover`}
    />
  );
}
