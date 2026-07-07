import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, getServerUtilization } from "../../services/pterodactyl";
import type { PterodactylServerAttributes } from "../../services/pterodactyl";
import { statusEmoji, resourceBar, cpuBar } from "../../utils/format";
import { startLiveDashboard } from "../../utils/live-dashboard";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:node");

async function buildAllNodesEmbed(): Promise<EmbedBuilder> {
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
      .setTitle("\ud83d\udda5\ufe0f Nodes (0)")
      .setDescription("No nodes were found on this panel.")
      .setTimestamp();
  }

  // Fetch all servers once and group by node ID (avoids per-node filter API calls)
  let allServers: PterodactylServerAttributes[] = [];
  try {
    allServers = await pterodactyl.listAllServers();
  } catch (err) {
    logger.warn("listAllServers failed in /node", { error: err instanceof Error ? err.message : String(err) });
  }

  const serversByNode = new Map<number, PterodactylServerAttributes[]>();
  for (const server of allServers) {
    const list = serversByNode.get(server.node) ?? [];
    list.push(server);
    serversByNode.set(server.node, list);
  }

  const fields = await Promise.all(
    nodes.map(async (node) => {
      const statusLabel = node.maintenance_mode
        ? `${EMOJIS.reload} Maintenance`
        : `${statusEmoji(true)} Online`;

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

      return {
        name: `${statusEmoji(!node.maintenance_mode)} ${node.name}`,
        value: [
          `Status: ${statusLabel}`,
          `Servers: ${servers.length} (${onlineCount} online)`,
          ramLine,
          diskLine,
          cpuLine,
        ].join("\n"),
        inline: false,
      };
    }),
  );

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`\ud83d\udda5\ufe0f Nodes (${nodes.length})`)
    .addFields(fields)
    .setFooter({ text: "Auto-refreshing every 30 seconds" })
    .setTimestamp();
}

export const nodeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("node")
    .setDescription("Show a live status dashboard for all Pterodactyl nodes"),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply();
    await startLiveDashboard(interaction, buildAllNodesEmbed);
  },
};
