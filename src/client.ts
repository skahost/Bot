import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type { Command } from "./types";

/**
 * Guild + interaction data plus guild messages and message content, the
 * latter two (privileged) intents are required to support the `*help`
 * legacy prefix command alongside the primary slash commands. Message
 * Content Intent must be enabled for this bot in the Discord Developer
 * Portal (Bot > Privileged Gateway Intents) or prefix commands will not fire.
 */
export function createDiscordClient(): Client & {
  commands: Collection<string, Command>;
} {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  }) as Client & { commands: Collection<string, Command> };

  client.commands = new Collection<string, Command>();

  return client;
}
