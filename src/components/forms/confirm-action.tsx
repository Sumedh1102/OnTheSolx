"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Button that runs a (bound) server action, optionally behind a confirmation dialog. */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  icon,
  successHref,
  className,
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  confirm?: { title: string; description?: string; confirmLabel?: string; danger?: boolean };
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  successHref?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const run = () =>
    start(async () => {
      const res = await action();
      setOpen(false);
      if (res.ok) {
        toast.success(res.message ?? "Done");
        if (successHref) router.push(successHref);
        else router.refresh();
      } else toast.error("Couldn't complete", res.error);
    });

  return (
    <>
      <Button variant={variant} size={size} icon={icon} loading={pending && !confirm} className={className} onClick={() => (confirm ? setOpen(true) : run())}>
        {children}
      </Button>
      {confirm ? (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          description={confirm.description}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant={confirm.danger ? "danger" : "primary"} loading={pending} onClick={run}>
                {confirm.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <p className="text-sm">{confirm.danger ? "This can't be undone." : "Please confirm to continue."}</p>
        </Modal>
      ) : null}
    </>
  );
}
