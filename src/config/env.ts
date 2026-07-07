/**
 * Centralized environment configuration.
 *
 * All secrets/config are read once here and validated at startup so the bot
 * fails fast with a clear error instead of crashing later mid-operation.
 */
import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in your .env file or hosting panel's environment variables.`,
    );
  }
  return value.trim();
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function parseOwnerIds(): string[] {
  const raw = optionalEnv("OWNER_IDS");
  const defaults = ["1306909424253800481", "1445095123175346307"];

  if (!raw) {
    return defaults;
  }

  const parsed = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return parsed.length > 0 ? parsed : defaults;
}

export const env = {
  discordToken: requireEnv("DISCORD_TOKEN"),
  discordClientId: requireEnv("DISCORD_CLIENT_ID"),
  discordGuildId: optionalEnv("DISCORD_GUILD_ID"),
  pterodactylPanelUrl: requireEnv("PTERODACTYL_PANEL_URL").replace(/\/+$/, ""),
  pterodactylApiKey: requireEnv("PTERODACTYL_API_KEY"),
  pterodactylClientApiKey: optionalEnv("PTERODACTYL_CLIENT_API_KEY"),
  ownerIds: parseOwnerIds(),
  nodeEnv: process.env["NODE_ENV"] ?? "production",
};

export const STATUS_REFRESH_INTERVAL_MS = 30_000;
export const COMMAND_COOLDOWN_MS = 3_000;
export const API_TIMEOUT_MS = 10_000;
export const API_MAX_RETRIES = 3;
export const API_RETRY_BASE_DELAY_MS = 500;
