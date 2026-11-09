export function cleanSupabaseUrl(url?: string | null): string {
  if (!url) return "";
  let u = url.trim();
  u = u.replace(/^['"]+|['"]+$/g, "");
  u = u.replace(/\/rest\/v1\/?$/, "");
  u = u.replace(/\/auth\/v1\/?$/, "");
  u = u.replace(/\/+$/, "");
  return u;
}

export function cleanSupabaseKey(key?: string | null): string {
  if (!key) return "";
  return key.trim().replace(/^['"]+|['"]+$/g, "");
}
