import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl } from "../../services/pterodactyl";
import { formatUptime, statusEmoji } from "../../utils/format";
import { startLiveDashboard } from "../../utils/live-dashboard";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:status");

function buildStatusEmbed(
  apiResult: { online: boolean; responseTimeMs: number },
  clientUptime: number,
  wsPing: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(apiResult.online ? 0x57f287 : 0xed4245)
    .setTitle(`${EMOJIS.light} System Status Dashboard`)
    .setDescription("Live status for the bot and the connected panel.")
    .addFields(
      {
        name: "Bot Status",
        value: `${statusEmoji(true)} Online`,
        inline: true,
      },
      {
        name: "Panel Status",
        value: `${statusEmoji(apiResult.online)} ${apiResult.online ? "Reachable" : "Unreachable"}`,
        inline: true,
      },
      {
        name: "API Status",
        value: `${statusEmoji(apiResult.online)} ${apiResult.online ? "Operational" : "Down"}`,
        inline: true,
      },
      {
        name: "Bot Uptime",
        value: formatUptime(clientUptime),
        inline: true,
      },
      {
        name: "Discord Ping",
        value: `${Math.max(wsPing, 0)}ms`,
        inline: true,
      },
      {
        name: "WebSocket Ping",
        value: `${Math.max(wsPing, 0)}ms`,
        inline: true,
      },
      {
        name: "Application API Response Time",
        value: apiResult.online ? `${apiResult.responseTimeMs}ms` : "N/A",
        inline: true,
      },
    )
    .setFooter({ text: "Auto-refreshing every 30 seconds" })
    .setTimestamp();
}

export const statusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show a full bot, panel, and API status dashboard"),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply();

    try {
      await startLiveDashboard(interaction, async () => {
        const apiResult = await pterodactyl.ping();
        return buildStatusEmbed(
          apiResult,
          interaction.client.uptime ?? 0,
          interaction.client.ws.ping,
        );
      });
    } catch (error) {
      logger.error("Failed to build status dashboard", error);
      await interaction.editReply({
        content: `${EMOJIS.cross} Failed to fetch panel status. Please try again shortly.`,
      });
    }
  },
};
