"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitAsButton({ children, icon, variant = "primary" }: { children: ReactNode; icon?: ReactNode; variant?: "primary" | "dark" | "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} icon={icon} variant={variant} className="w-full">
      {children}
    </Button>
  );
}
