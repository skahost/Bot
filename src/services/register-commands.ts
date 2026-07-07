import { REST, Routes } from "discord.js";
import { commands } from "../commands";
import { env } from "../config/env";
import { createLogger } from "../utils/logger";

const logger = createLogger("register-commands");

/**
 * Registers all slash commands with Discord. Uses guild-scoped registration
 * when DISCORD_GUILD_ID is set (instant, good for development) and falls
 * back to global registration otherwise (can take up to an hour to
 * propagate, but works across every server the bot is in).
 */
export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(env.discordToken);
  const body = commands.map((command) => command.data.toJSON());

  try {
    if (env.discordGuildId) {
      await rest.put(
        Routes.applicationGuildCommands(env.discordClientId, env.discordGuildId),
        { body },
      );
      logger.info(
        `Registered ${body.length} slash commands to guild ${env.discordGuildId}`,
      );
    } else {
      await rest.put(Routes.applicationCommands(env.discordClientId), { body });
      logger.info(`Registered ${body.length} slash commands globally`);
    }
  } catch (error) {
    logger.error("Failed to register slash commands", error);
    throw error;
  }
}
