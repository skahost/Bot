import { COMMAND_COOLDOWN_MS } from "../config/env";

/**
 * Simple per-user, per-command cooldown tracker to prevent command spam and
 * abuse (e.g. rapid-fire /restart calls hammering the panel API).
 */
const lastInvocations = new Map<string, number>();

export function checkCooldown(
  userId: string,
  commandName: string,
): { onCooldown: boolean; remainingMs: number } {
  const key = `${userId}:${commandName}`;
  const now = Date.now();
  const last = lastInvocations.get(key);

  if (last !== undefined) {
    const elapsed = now - last;
    if (elapsed < COMMAND_COOLDOWN_MS) {
      return { onCooldown: true, remainingMs: COMMAND_COOLDOWN_MS - elapsed };
    }
  }

  lastInvocations.set(key, now);
  return { onCooldown: false, remainingMs: 0 };
}
