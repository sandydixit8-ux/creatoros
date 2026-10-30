import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { BrandMark } from "@/components/brand/brand-mark";

export const metadata: Metadata = { title: "Create account", description: "Start building with CreatorOS" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <BrandMark className="h-12 w-12 rounded-xl" />
          <h1 className="mt-4 text-2xl font-bold text-navy-950">Create your account</h1>
          <p className="mt-1 text-sm text-navy-500">Free forever plan. No card required.</p>
        </div>
        <div className="card p-8">
          <AuthForm mode="register" />
        </div>
        <p className="mt-6 text-center text-sm text-navy-500">
          Already have an account? <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">Log in</Link>
        </p>
      </div>
    </div>
  );
}
