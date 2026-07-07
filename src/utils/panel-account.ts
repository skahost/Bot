/**
 * Helpers for deriving a Pterodactyl panel account from a Discord username
 * when auto-provisioning a user during /create-server.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Pterodactyl usernames only allow letters, numbers, dashes, underscores,
 * and periods. Discord usernames are usually already compatible, but this
 * strips anything else and guarantees a minimum length so the Application
 * API doesn't reject the request with a validation error.
 */
export function sanitizePanelUsername(discordUsername: string): string {
  const cleaned = discordUsername
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");

  const withMinLength = cleaned.length >= 3 ? cleaned : `${cleaned}user`.padEnd(3, "0");
  return withMinLength.slice(0, 32);
}
