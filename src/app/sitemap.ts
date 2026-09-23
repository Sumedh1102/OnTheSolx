import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/book", priority: 0.9, changeFrequency: "daily" },
  { path: "/coaching", priority: 0.8, changeFrequency: "monthly" },
  { path: "/membership", priority: 0.8, changeFrequency: "monthly" },
  { path: "/coaches", priority: 0.7, changeFrequency: "monthly" },
  { path: "/events", priority: 0.7, changeFrequency: "weekly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/facilities", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
  try {
    const { db } = await import("@/server/db");
    const { events } = await import("@/server/db/schema");
    const rows = await db.select({ slug: events.slug, updatedAt: events.updatedAt }).from(events).where(eq(events.status, "PUBLISHED"));
    for (const e of rows) entries.push({ url: `${base}/events/${e.slug}`, lastModified: e.updatedAt, changeFrequency: "weekly", priority: 0.5 });
  } catch {
    // Database unavailable — serve the static routes only.
  }
  return entries;
}
