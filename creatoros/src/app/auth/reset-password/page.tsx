import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { BrandMark } from "@/components/brand/brand-mark";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your CreatorOS account",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <BrandMark className="h-12 w-12 rounded-xl" />
          <h1 className="mt-4 text-2xl font-bold text-navy-950">Choose a new password</h1>
          <p className="mt-1 text-sm text-navy-500">Use at least 10 characters</p>
        </div>
        <div className="card p-8">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
