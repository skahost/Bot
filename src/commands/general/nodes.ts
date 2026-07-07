import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, getServerUtilization } from "../../services/pterodactyl";
import type { PterodactylServerAttributes } from "../../services/pterodactyl";
import { statusEmoji, resourceBar, cpuBar } from "../../utils/format";
import { startLiveDashboard } from "../../utils/live-dashboard";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:nodes");

async function buildNodesEmbed(): Promise<EmbedBuilder> {
  let nodes;
  try {
    nodes = await pterodactyl.listNodes();
  } catch (err) {
    logger.warn("listNodes failed", { error: err instanceof Error ? err.message : String(err) });
    return new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`${EMOJIS.cross} Panel Unreachable`)
      .setDescription("Could not fetch nodes from the panel. Check your API key or panel status.")
      .setTimestamp();
  }

  if (nodes.length === 0) {
    return new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("\ud83c\udf10 Nodes (0)")
      .setDescription("No nodes were found on this panel.")
      .setTimestamp();
  }

  // Fetch all servers once and group by node ID
  let allServers: PterodactylServerAttributes[] = [];
  try {
    allServers = await pterodactyl.listAllServers();
  } catch (err) {
    logger.warn("listAllServers failed in /nodes", { error: err instanceof Error ? err.message : String(err) });
  }

  const serversByNode = new Map<number, PterodactylServerAttributes[]>();
  for (const server of allServers) {
    const list = serversByNode.get(server.node) ?? [];
    list.push(server);
    serversByNode.set(server.node, list);
  }

  const lines = await Promise.all(
    nodes.map(async (node) => {
      const statusIcon = node.maintenance_mode ? EMOJIS.reload : statusEmoji(true);
      const statusLabel = node.maintenance_mode ? "Maintenance" : "Online";

      const totalMemMib = node.memory;
      const totalDiskMib = node.disk;
      const servers = serversByNode.get(node.id) ?? [];

      const utilizations = await Promise.allSettled(
        servers.map((s) => getServerUtilization(s.identifier)),
      );

      let usedMemBytes = 0;
      let usedDiskBytes = 0;
      let usedCpu = 0;
      let onlineCount = 0;

      for (const result of utilizations) {
        const u = result.status === "fulfilled" ? result.value : undefined;
        if (u?.state === "running") onlineCount++;
        usedMemBytes += u?.memoryBytes ?? 0;
        usedDiskBytes += u?.diskBytes ?? 0;
        usedCpu += u?.cpuAbsolute ?? 0;
      }

      const ramLine = resourceBar(usedMemBytes, totalMemMib, "RAM", EMOJIS.ram);
      const diskLine = resourceBar(usedDiskBytes, totalDiskMib, "Disk", EMOJIS.disk);
      const cpuLine = cpuBar(usedCpu, 0, EMOJIS.cpu);

      return [
        `${statusIcon} **${node.name}** — ${statusLabel} | Servers: ${servers.length} (${onlineCount} online)`,
        `\u00a0\u00a0${ramLine}`,
        `\u00a0\u00a0${diskLine}`,
        `\u00a0\u00a0${cpuLine}`,
      ].join("\n");
    }),
  );

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`\ud83c\udf10 Nodes (${nodes.length})`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: "Auto-refreshing every 30 seconds" })
    .setTimestamp();
}

export const nodesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("nodes")
    .setDescription("List all Pterodactyl nodes with live RAM/CPU/Disk stats"),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply();
    await startLiveDashboard(interaction, buildNodesEmbed);
  },
};
