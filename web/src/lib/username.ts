/**
 * Staff sign in with a username, not an email. Same rules as Better Auth's username plugin
 * (3-30 characters: letters, numbers, underscore, dot; case-insensitive), applied here too
 * because the plugin only validates its own sign-up route, not the admin createUser call.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
export const USERNAME_HINT = "3 to 30 letters, numbers, dots or underscores. Not case-sensitive.";

/** "Dr.Ahmed" and "dr.ahmed" are the same account; stored lowercase, as the plugin does. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Better Auth still requires an email on every user. Staff never see or use it: it is a
 * placeholder on the reserved .invalid domain, which can never receive mail.
 */
export function placeholderEmail(username: string): string {
  return `${normalizeUsername(username)}@users.nide-ward.invalid`;
}
