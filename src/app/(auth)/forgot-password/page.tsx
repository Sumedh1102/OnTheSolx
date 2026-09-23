import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { ForgotPasswordForm } from "@/components/forms/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="rounded-[var(--radius-card)] border-3 border-ink bg-white p-6 shadow-brutal-lg sm:p-8">
      <h1 className="text-4xl font-extrabold leading-none">Forgot your password?</h1>
      <p className="mb-7 mt-2 text-muted">Enter the email on your account and we&apos;ll send you a link to set a new one.</p>
      <ForgotPasswordForm />
    </div>
  );
}
