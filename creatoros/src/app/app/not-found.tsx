import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <FileQuestion className="mx-auto h-10 w-10 text-brand-600" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-navy-950">Page not found</h1>
      <p className="mt-2 text-sm text-navy-500">
        The dashboard page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/app" className="btn-primary mt-6 justify-center">
        Back to Dashboard
      </Link>
    </div>
  );
}