import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, getServerUtilization } from "../../services/pterodactyl";
import { truncate } from "../../utils/format";
import { startLiveDashboard } from "../../utils/live-dashboard";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:servers");
const MAX_LISTED = 25;

async function buildServersEmbed(): Promise<EmbedBuilder> {
  const [servers, users] = await Promise.all([
    pterodactyl.listAllServers(),
    pterodactyl.listUsers(),
  ]);

  if (servers.length === 0) {
    return new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`${EMOJIS.cross} No Servers Found`)
      .setDescription("No servers were found on this panel.")
      .setTimestamp();
  }

  const userMap = new Map(users.map((u) => [u.id, u.email]));

  const shown = servers.slice(0, MAX_LISTED);

  const lines = await Promise.all(
    shown.map(async (server) => {
      const email = userMap.get(server.user) ?? "Unknown";

      if (server.suspended) {
        return [
          `${EMOJIS.cross} **${truncate(server.name, 32)}** — Suspended`,
          `\u00a0\u00a0📧 \`${email}\` \u2022 UUID: \`${server.uuid}\` \u2022 ID: \`${server.identifier}\``,
        ].join("\n");
      }

      const u = await getServerUtilization(server.identifier);
      const online = u?.state === "running";
      const statusIcon = online ? EMOJIS.online : EMOJIS.cross;
      const statusLabel = online ? "Online" : "Offline";

      return [
        `${statusIcon} **${truncate(server.name, 32)}** — ${statusLabel}`,
        `\u00a0\u00a0📧 \`${email}\` \u2022 UUID: \`${server.uuid}\` \u2022 ID: \`${server.identifier}\``,
      ].join("\n");
    }),
  );

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`\ud83d\udcca Servers (${servers.length})`)
    .setDescription(lines.join("\n\n"))
    .setTimestamp();

  if (servers.length > MAX_LISTED) {
    embed.setFooter({
      text: `Showing ${MAX_LISTED} of ${servers.length} servers \u2022 Auto-refreshing every 30 seconds`,
    });
  } else {
    embed.setFooter({ text: "Auto-refreshing every 30 seconds" });
  }

  return embed;
}

export const serversCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("servers")
    .setDescription("[Admin] List all servers with email, UUID, identifier, and status"),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply();

    try {
      await startLiveDashboard(interaction, buildServersEmbed);
    } catch (error) {
      logger.error("Failed to build servers dashboard", error);
      await interaction.editReply({
        content: `${EMOJIS.cross} Failed to fetch servers from the panel. Please try again shortly.`,
      });
    }
  },
};
