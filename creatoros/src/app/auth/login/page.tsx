import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { BrandMark } from "@/components/brand/brand-mark";

export const metadata: Metadata = { title: "Log in", description: "Log in to CreatorOS" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <BrandMark className="h-12 w-12 rounded-xl" />
          <h1 className="mt-4 text-2xl font-bold text-navy-950">Welcome back</h1>
          <p className="mt-1 text-sm text-navy-500">Log in to your CreatorOS workspace</p>
        </div>
        <div className="card p-8">
          <AuthForm mode="login" />
          <p className="mt-4 text-center text-sm text-navy-500">
            <Link href="/auth/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
              Forgot your password?
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-navy-500">
          New to CreatorOS? <Link href="/auth/register" className="font-medium text-brand-600 hover:text-brand-700">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
