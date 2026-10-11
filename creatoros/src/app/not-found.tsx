import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-night-950 px-4 text-center text-ink">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
        <Compass className="h-7 w-7" aria-hidden />
      </div>
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-brand-400">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-ink-secondary">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="btn-primary px-6 py-2.5">
          Back to home
        </Link>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-2.5 font-medium text-ink transition-colors hover:bg-white/10"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}