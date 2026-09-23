"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element (focus trapping, Esc to close,
 * inert background) with neo-brutalist styling. On small screens it docks to the bottom.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/50 backdrop:backdrop-blur-[1px] sm:m-auto",
        widths[size],
      )}
    >
      {open ? (
        <div className="animate-pop max-h-[90dvh] overflow-y-auto rounded-t-3xl border-3 border-ink bg-white shadow-brutal-lg sm:rounded-3xl">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-3 border-ink bg-white px-5 py-4">
            <div>
              <h2 className="text-xl font-extrabold leading-tight">{title}</h2>
              {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white hover:bg-paper"
              aria-label="Close dialog"
            >
              <X className="size-4" strokeWidth={3} />
            </button>
          </div>
          <div className="px-5 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t-3 border-ink bg-paper px-5 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
