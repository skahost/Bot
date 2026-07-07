import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl } from "../../services/pterodactyl";
import { formatUptime } from "../../utils/format";
import { EMOJIS } from "../../config/emojis";

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show bot, Discord, and Pterodactyl API latency"),
  adminOnly: true,
  async execute(interaction) {
    const sentAt = Date.now();
    await interaction.deferReply();

    const roundTripMs = Date.now() - sentAt;
    const apiResult = await pterodactyl.ping();

    const embed = new EmbedBuilder()
      .setColor(apiResult.online ? 0x57f287 : 0xed4245)
      .setTitle(`${EMOJIS.bluewings} Pong!`)
      .addFields(
        { name: "Bot Latency", value: `${roundTripMs}ms`, inline: true },
        {
          name: "Discord WebSocket Ping",
          value: `${Math.max(interaction.client.ws.ping, 0)}ms`,
          inline: true,
        },
        {
          name: "Pterodactyl API Response Time",
          value: apiResult.online
            ? `${EMOJIS.check} ${apiResult.responseTimeMs}ms`
            : `${EMOJIS.cross} Unreachable`,
          inline: true,
        },
        {
          name: "Bot Uptime",
          value: formatUptime(interaction.client.uptime ?? 0),
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
