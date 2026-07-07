import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, getServerUtilization } from "../../services/pterodactyl";
import { truncate, formatUptime, statusEmoji, resourceBar, cpuBar } from "../../utils/format";
import { startLiveDashboard } from "../../utils/live-dashboard";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:list-servers");
const MAX_LISTED = 25;

async function buildListServersEmbed(): Promise<EmbedBuilder> {
  const servers = await pterodactyl.listAllServers();

  if (servers.length === 0) {
    return new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`${EMOJIS.cross} No Servers Found`)
      .setDescription("No servers were found on this panel.")
      .setTimestamp();
  }

  const shown = servers.slice(0, MAX_LISTED);

  const lines = await Promise.all(
    shown.map(async (server) => {
      const ramLimit = server.limits.memory;
      const diskLimit = server.limits.disk;
      const cpuLimit = server.limits.cpu;

      if (server.suspended) {
        return [
          `${EMOJIS.cross} **${truncate(server.name, 36)}** — Suspended`,
          `\u00a0\u00a0${resourceBar(0, ramLimit, "RAM", EMOJIS.ram)}`,
          `\u00a0\u00a0${resourceBar(0, diskLimit, "Disk", EMOJIS.disk)}`,
          `\u00a0\u00a0${cpuBar(0, cpuLimit, EMOJIS.cpu)}`,
        ].join("\n");
      }

      const u = await getServerUtilization(server.identifier);
      if (!u) {
        return [
          `${EMOJIS.reload} **${truncate(server.name, 36)}** — Unknown`,
          `\u00a0\u00a0${resourceBar(0, ramLimit, "RAM", EMOJIS.ram)}`,
          `\u00a0\u00a0${resourceBar(0, diskLimit, "Disk", EMOJIS.disk)}`,
          `\u00a0\u00a0${cpuBar(0, cpuLimit, EMOJIS.cpu)}`,
        ].join("\n");
      }

      const online = u.state === "running";
      const statusIcon = statusEmoji(online);
      const statusLabel = online
        ? `Online \u2022 ${EMOJIS.uptime} ${formatUptime(u.uptimeMs)}`
        : "Offline";

      const ramLine = resourceBar(u.memoryBytes, ramLimit, "RAM", EMOJIS.ram);
      const diskLine = resourceBar(u.diskBytes, diskLimit, "Disk", EMOJIS.disk);
      const cpuLine = cpuBar(u.cpuAbsolute, cpuLimit, EMOJIS.cpu);

      return [
        `${statusIcon} **${truncate(server.name, 36)}** — ${statusLabel}`,
        `\u00a0\u00a0${ramLine}`,
        `\u00a0\u00a0${diskLine}`,
        `\u00a0\u00a0${cpuLine}`,
      ].join("\n");
    }),
  );

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`\ud83d\udccb Servers (${servers.length})`)
    .setDescription(lines.join("\n\n"))
    .setTimestamp();

  embed.setFooter({
    text: servers.length > MAX_LISTED
      ? `Showing ${MAX_LISTED} of ${servers.length} servers \u2022 Auto-refreshing every 30 seconds`
      : "Auto-refreshing every 30 seconds",
  });

  return embed;
}

export const listServersCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("list-servers")
    .setDescription("List all servers with live RAM/CPU/Disk usage"),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply();

    try {
      await startLiveDashboard(interaction, buildListServersEmbed);
    } catch (error) {
      logger.error("Failed to list servers", error);
      await interaction.editReply({
        content: `${EMOJIS.cross} Failed to fetch servers from the panel. Please try again shortly.`,
      });
    }
  },
};
