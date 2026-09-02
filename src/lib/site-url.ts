const DEFAULT_SITE_URL = "https://focusx.in";

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL;

  return rawUrl.replace(/\/+$/, "");
}
