import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[var(--radius-control)] border-2 border-ink bg-white px-3.5 text-[15px] text-ink placeholder:text-subtle " +
  "shadow-[inset_0_-2px_0_0_rgb(11_11_15/0.06)] transition-[box-shadow,border-color] " +
  "focus:outline-none focus:shadow-brutal-xs focus:border-brand focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-paper-2 disabled:opacity-70 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft/40";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-11 appearance-none pr-10 font-medium", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" strokeWidth={2.5} aria-hidden />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-bold text-ink", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | string[] | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-brand">*</span> : null}
      </Label>
      {children}
      {message ? (
        <p className="mt-1.5 text-sm font-semibold text-danger" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, description, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        type="checkbox"
        className="peer mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-md border-2 border-ink bg-white transition checked:bg-brand checked:shadow-brutal-xs focus-visible:outline-3 focus-visible:outline-brand bg-[length:14px] bg-center bg-no-repeat checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%224%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M20 6 9 17l-5-5%22/></svg>')]"
        {...props}
      />
      <span className="text-sm">
        <span className="font-semibold">{label}</span>
        {description ? <span className="mt-0.5 block text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Switch({ label, description, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4", className)}>
      <span className="text-sm">
        <span className="font-bold">{label}</span>
        {description ? <span className="mt-0.5 block text-muted">{description}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span className="h-7 w-12 rounded-full border-2 border-ink bg-paper-2 transition peer-checked:bg-brand peer-focus-visible:outline-3 peer-focus-visible:outline-brand" />
        <span className="absolute left-1 top-1 size-5 rounded-full border-2 border-ink bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Radio options rendered as chunky selectable cards. */
export function RadioCards<T extends string | number>({
  name,
  options,
  value,
  defaultValue,
  onChange,
  className,
}: {
  name: string;
  options: { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("grid gap-2", className)}>
      {options.map((opt) => (
        <label
          key={String(opt.value)}
          className={cn(
            "relative flex cursor-pointer flex-col rounded-xl border-2 border-ink bg-white px-4 py-3 transition has-[:checked]:bg-brand has-[:checked]:text-white has-[:checked]:shadow-brutal-sm hover:bg-brand-50 has-[:checked]:hover:bg-brand has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand",
          )}
        >
          <input
            type="radio"
            name={name}
            value={String(opt.value)}
            className="sr-only"
            disabled={opt.disabled}
            {...(value !== undefined ? { checked: value === opt.value } : { defaultChecked: defaultValue === opt.value })}
            onChange={() => onChange?.(opt.value)}
          />
          <span className="font-display text-base font-extrabold">{opt.label}</span>
          {opt.description ? <span className="text-xs opacity-80">{opt.description}</span> : null}
        </label>
      ))}
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  if (!children) return null;
  const tones = {
    error: "bg-danger-soft",
    success: "bg-success-soft",
    info: "bg-brand-50",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border-2 border-ink px-4 py-3 text-sm font-semibold", tones[tone])}>
      {children}
    </div>
  );
}
