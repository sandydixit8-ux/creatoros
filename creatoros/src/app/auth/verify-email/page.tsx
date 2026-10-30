import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { BrandMark } from "@/components/brand/brand-mark";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm your email address for CreatorOS",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <BrandMark className="h-12 w-12 rounded-xl" />
          <h1 className="mt-4 text-2xl font-bold text-navy-950">Verify your email</h1>
          <p className="mt-1 text-sm text-navy-500">Confirming this link completes verification</p>
        </div>
        <div className="card p-8">
          <VerifyEmailForm />
        </div>
      </div>
    </div>
  );
}
