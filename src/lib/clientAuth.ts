export const CLIENT_EMAIL_DOMAIN = "cliente.cwfinancas.local";

export function slugifyUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 40);
}

/**
 * Accepts either an email or a username.
 * - If contains "@", returns as-is (trimmed).
 * - Otherwise treats as username and converts to synthetic email.
 */
export function resolveLoginEmail(identifier: string): string {
  const v = identifier.trim();
  if (v.includes("@")) return v;
  return `${slugifyUsername(v)}@${CLIENT_EMAIL_DOMAIN}`;
}
