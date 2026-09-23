import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/forms/password-reset-forms";
import { isResetTokenUsable } from "@/server/services/password-reset";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const usable = typeof token === "string" && token.length >= 20 && token.length <= 100 && (await isResetTokenUsable(token));

  return (
    <div className="rounded-[var(--radius-card)] border-3 border-ink bg-white p-6 shadow-brutal-lg sm:p-8">
      {usable ? (
        <>
          <h1 className="text-4xl font-extrabold leading-none">Choose a new password.</h1>
          <p className="mb-7 mt-2 text-muted">You&apos;ll be signed out on every device, then you can sign in with the new password.</p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <>
          <h1 className="text-4xl font-extrabold leading-none">This link has expired.</h1>
          <p className="mb-7 mt-2 text-muted">Reset links work once and only for 60 minutes. Request a fresh one and use the newest email.</p>
          <ButtonLink href="/forgot-password" size="lg">
            Send a new link
          </ButtonLink>
        </>
      )}
    </div>
  );
}
