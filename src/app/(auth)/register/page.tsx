import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { RegisterForm } from "@/components/forms/register-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="rounded-[var(--radius-card)] border-3 border-ink bg-white p-6 shadow-brutal-lg sm:p-8">
      <h1 className="text-4xl font-extrabold leading-none">Join the academy.</h1>
      <p className="mb-7 mt-2 text-muted">One account for bookings, training, attendance and membership.</p>
      <RegisterForm next={typeof next === "string" ? next : undefined} />
    </div>
  );
}
