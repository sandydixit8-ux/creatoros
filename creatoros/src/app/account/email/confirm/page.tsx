import type { Metadata } from "next";
import { EmailChangeConfirm } from "@/components/account/email-change-confirm";

export const metadata: Metadata = { title: "Confirm email change", description: "Confirm your CreatorOS email change" };

export default function ConfirmEmailChangePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">C</span>
          <h1 className="mt-4 text-2xl font-bold text-navy-950">Email change</h1>
        </div>
        <div className="card p-8">
          <EmailChangeConfirm />
        </div>
      </div>
    </div>
  );
}
