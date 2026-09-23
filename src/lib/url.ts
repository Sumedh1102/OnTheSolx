/** Builds `${path}?…` from current params with overrides; empty values are dropped. */
export function hrefWith(path: string, current: Record<string, string | string[] | undefined>, overrides: Record<string, string | number | null | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (typeof v === "string" && v !== "") params.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === undefined || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function param(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
