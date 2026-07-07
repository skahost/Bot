import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, getServerUtilization } from "../../services/pterodactyl";
import { formatMiB, formatUptime, statusEmoji, resourceBar, cpuBar } from "../../utils/format";
import { startLiveDashboard } from "../../utils/live-dashboard";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:server-info");

export const serverInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("server-info")
    .setDescription("Show detailed live information about a server")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Server identifier, UUID, or ID")
        .setRequired(true),
    ),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply();
    const identifier = interaction.options.getString("server", true);

    try {
      const server = await pterodactyl.getServerByIdentifier(identifier);

      if (!server) {
        await interaction.editReply({
          content: `${EMOJIS.cross} No server matching \`${identifier}\` was found.`,
        });
        return;
      }

      await startLiveDashboard(interaction, async () => {
        const utilization = await getServerUtilization(server.identifier);

        const online = utilization?.state === "running";
        const installLabel =
          server.container.installed === 1
            ? `${EMOJIS.check} Installed`
            : server.container.installed === 2
              ? `${EMOJIS.cross} Install Failed`
              : `${EMOJIS.reload} Installing`;

        const statusValue = server.suspended
          ? `${EMOJIS.cross} Suspended`
          : utilization
            ? online
              ? `${EMOJIS.online} Online`
              : `${EMOJIS.cross} Offline`
            : `${EMOJIS.reload} Unknown`;

        const uptimeValue =
          utilization && online ? formatUptime(utilization.uptimeMs) : "\u2014";

        const ramLine = utilization
          ? resourceBar(utilization.memoryBytes, server.limits.memory, "RAM", EMOJIS.ram)
          : `${EMOJIS.ram} RAM: \`░░░░░░░░░░░░░░\` — / ${formatMiB(server.limits.memory)}`;

        const diskLine = utilization
          ? resourceBar(utilization.diskBytes, server.limits.disk, "Disk", EMOJIS.disk)
          : `${EMOJIS.disk} Disk: \`░░░░░░░░░░░░░░\` — / ${formatMiB(server.limits.disk)}`;

        const cpuLine = utilization
          ? cpuBar(utilization.cpuAbsolute, server.limits.cpu, EMOJIS.cpu)
          : `${EMOJIS.cpu} CPU: \`░░░░░░░░░░░░░░\` — / ${server.limits.cpu}%`;

        return new EmbedBuilder()
          .setColor(server.suspended ? 0xed4245 : online ? 0x57f287 : 0x99aab5)
          .setTitle(`\ud83d\udda5\ufe0f ${server.name}`)
          .setDescription(server.description || "No description set.")
          .addFields(
            { name: "Status", value: statusValue, inline: true },
            { name: `${EMOJIS.uptime} Uptime`, value: uptimeValue, inline: true },
            { name: "Install", value: installLabel, inline: true },
            { name: "Identifier", value: `\`${server.identifier}\``, inline: true },
            { name: "UUID", value: `\`${server.uuid}\``, inline: true },
            { name: "Suspended", value: server.suspended ? `${EMOJIS.cross} Yes` : `${EMOJIS.check} No`, inline: true },
            { name: "Node", value: `\`${server.node}\``, inline: true },
            { name: "Owner", value: `\`${server.user}\``, inline: true },
            { name: "Databases / Backups", value: `${server.feature_limits.databases} / ${server.feature_limits.backups}`, inline: true },
            { name: "\u200b", value: ramLine },
            { name: "\u200b", value: diskLine },
            { name: "\u200b", value: cpuLine },
            { name: "Docker Image", value: `\`${server.container.image}\`` },
          )
          .setFooter({ text: `Server ID: ${server.id} \u2022 Auto-refreshing every 30 seconds` })
          .setTimestamp();
      });
    } catch (error) {
      logger.error("Failed to fetch server info", error);
      await interaction.editReply({
        content: `${EMOJIS.cross} Failed to fetch server info from the panel. Please try again shortly.`,
      });
    }
  },
};
