import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { LoginForm } from "@/components/forms/login-form";
import { FormMessage } from "@/components/ui/form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reset } = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  const showDemo = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";
  return (
    <div className="rounded-[var(--radius-card)] border-3 border-ink bg-white p-6 shadow-brutal-lg sm:p-8">
      <h1 className="text-4xl font-extrabold leading-none">Welcome back.</h1>
      <p className="mb-7 mt-2 text-muted">Sign in to your SmashPoint account.</p>
      {reset === "1" ? (
        <div className="mb-5">
          <FormMessage tone="success">Password updated. Sign in with your new password.</FormMessage>
        </div>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : undefined} showDemo={showDemo} />
    </div>
  );
}
