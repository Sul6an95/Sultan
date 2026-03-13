const PROXIED_HOSTS = [
  "cdn-api.pandascore.co",
  "cdn.pandascore.co",
  "static.lolesports.com",
];

export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  let trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) trimmed = `https:${trimmed}`;
  if (trimmed.startsWith("http://")) trimmed = `https://${trimmed.slice(7)}`;

  // Route blocked external hosts through backend proxy
  try {
    const parsed = new URL(trimmed);
    if (PROXIED_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
      return `/api/img-proxy?url=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    // not a full URL — return as-is
  }

  return trimmed;
}

export function initialsFromName(name: string, max = 2): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .substring(0, max)
    .toUpperCase();
}
