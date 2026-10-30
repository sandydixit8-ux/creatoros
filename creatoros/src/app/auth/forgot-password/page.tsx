import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { BrandMark } from "@/components/brand/brand-mark";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your CreatorOS password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <BrandMark className="h-12 w-12 rounded-xl" />
          <h1 className="mt-4 text-2xl font-bold text-navy-950">Reset your password</h1>
          <p className="mt-1 text-sm text-navy-500">We&apos;ll email you a secure link</p>
        </div>
        <div className="card p-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
