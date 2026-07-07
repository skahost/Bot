import type { GuildMember } from "discord.js";
import { env } from "../config/env";
import { isDynamicAdmin } from "./admin-store";

/** True for configured bot owners (OWNER_IDS) regardless of Discord server roles. */
export function isOwner(userId: string): boolean {
  return env.ownerIds.includes(userId);
}

/**
 * Admins are ONLY configured bot owners (OWNER_IDS) or Discord user IDs
 * granted admin access at runtime via `/admin add`. Discord server
 * roles/permissions (e.g. having "Administrator" in a guild) are
 * intentionally NOT consulted — being a server admin does not make someone
 * a bot admin. Everyone else is treated as a regular user. Admin-only
 * commands (everything except `/help` and `/manage`) are gated on this
 * check.
 */
export function isAdminMember(userId: string, _member?: GuildMember | null): boolean {
  return isOwner(userId) || isDynamicAdmin(userId);
}

export function isAdmin(interaction: {
  user: { id: string };
  member: unknown;
}): boolean {
  return isAdminMember(interaction.user.id, interaction.member as GuildMember | null);
}
