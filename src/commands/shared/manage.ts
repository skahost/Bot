import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type User,
} from "discord.js";
import type { ButtonHandler, Command } from "../../types";
import {
  pterodactyl,
  PterodactylApiError,
  getServerUtilization,
  sendPowerSignal,
  type PterodactylServerAttributes,
  type ServerUtilization,
} from "../../services/pterodactyl";
import { formatBytes, formatUptime } from "../../utils/format";
import { isAdmin } from "../../utils/permissions";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";
import { env } from "../../config/env";

const logger = createLogger("command:manage");

const BUTTON_PREFIX = "manage";

type ManageAction = "start" | "stop" | "restart" | "kill" | "reinstall" | "stats" | "refresh";

function encodeCustomId(action: ManageAction, serverIdentifier: string, requesterId: string): string {
  return `${BUTTON_PREFIX}:${action}:${serverIdentifier}:${requesterId}`;
}

function decodeCustomId(
  customId: string,
): { action: ManageAction; serverIdentifier: string; requesterId: string } | undefined {
  const parts = customId.split(":");
  if (parts.length !== 4 || parts[0] !== BUTTON_PREFIX) {
    return undefined;
  }
  const [, action, serverIdentifier, requesterId] = parts;
  return {
    action: action as ManageAction,
    serverIdentifier: serverIdentifier as string,
    requesterId: requesterId as string,
  };
}

function panelConsoleUrl(serverIdentifier: string): string {
  return `${env.pterodactylPanelUrl}/server/${serverIdentifier}`;
}

function buildManageRows(
  server: PterodactylServerAttributes,
  requesterId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeCustomId("start", server.identifier, requesterId))
      .setLabel("Start")
      .setEmoji(EMOJIS.start)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("stop", server.identifier, requesterId))
      .setLabel("Stop")
      .setEmoji(EMOJIS.stop)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("restart", server.identifier, requesterId))
      .setLabel("Restart")
      .setEmoji(EMOJIS.restart)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("kill", server.identifier, requesterId))
      .setLabel("Kill")
      .setEmoji(EMOJIS.kill)
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeCustomId("reinstall", server.identifier, requesterId))
      .setLabel("Reinstall")
      .setEmoji(EMOJIS.tools)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("stats", server.identifier, requesterId))
      .setLabel("Stats")
      .setEmoji(EMOJIS.stats)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel("Launch Panel")
      .setEmoji(EMOJIS.panel)
      .setStyle(ButtonStyle.Link)
      .setURL(panelConsoleUrl(server.identifier)),
  );

  return [row1, row2];
}

async function buildManageEmbed(
  server: PterodactylServerAttributes,
  utilization?: ServerUtilization,
): Promise<EmbedBuilder> {
  const util = utilization !== undefined ? utilization : await getServerUtilization(server.identifier);

  const embed = new EmbedBuilder()
    .setColor(server.suspended ? 0xed4245 : 0x5865f2)
    .setTitle(`${EMOJIS.panel} Manage: ${server.name}`)
    .addFields(
      { name: "Identifier", value: `\`${server.identifier}\``, inline: true },
      {
        name: "Status",
        value: server.suspended
          ? `${EMOJIS.cross} Suspended`
          : util
            ? util.state === "running"
              ? `${EMOJIS.online} Online`
              : `${EMOJIS.cross} Offline`
            : `${EMOJIS.reload} Unknown`,
        inline: true,
      },
      {
        name: `${EMOJIS.cpu} CPU Usage`,
        value: util ? `${util.cpuAbsolute.toFixed(1)}%` : "Unknown",
        inline: true,
      },
      {
        name: `${EMOJIS.ram} Memory`,
        value: util ? formatBytes(util.memoryBytes) : "Unknown",
        inline: true,
      },
      {
        name: `${EMOJIS.disk} Disk`,
        value: util ? formatBytes(util.diskBytes) : "Unknown",
        inline: true,
      },
      {
        name: `${EMOJIS.uptime} Uptime`,
        value: util && util.state === "running" ? formatUptime(util.uptimeMs) : "\u2014",
        inline: true,
      },
    )
    .setFooter({ text: "Use the buttons below to manage this server" })
    .setTimestamp();

  return embed;
}

// ── DM notification helpers ───────────────────────────────────────────────────

interface ActionMeta {
  label: string;
  emoji: string;
  color: number;
  description: string;
}

const ACTION_META: Record<ManageAction, ActionMeta> = {
  start: {
    label: "Server Started",
    emoji: EMOJIS.start,
    color: 0x22c55e,
    description: "Your server has been **started** successfully. It may take a few seconds to come fully online.",
  },
  stop: {
    label: "Server Stopped",
    emoji: EMOJIS.stop,
    color: 0xf97316,
    description: "Your server has been **stopped** gracefully.",
  },
  restart: {
    label: "Server Restarted",
    emoji: EMOJIS.restart,
    color: 0x5865f2,
    description: "Your server is **restarting**. It will be back online shortly.",
  },
  kill: {
    label: "Server Killed",
    emoji: EMOJIS.kill,
    color: 0xef4444,
    description: "Your server process was **force-killed**. All unsaved data may be lost.",
  },
  reinstall: {
    label: "Server Reinstalling",
    emoji: EMOJIS.tools,
    color: 0xeab308,
    description: "Your server is being **reinstalled**. This will wipe existing server files — wait for it to complete before starting.",
  },
  stats: {
    label: "Server Stats",
    emoji: EMOJIS.stats,
    color: 0x7c3aed,
    description: "Live resource usage snapshot for your server.",
  },
  refresh: {
    label: "Panel Refreshed",
    emoji: EMOJIS.restart,
    color: 0x5865f2,
    description: "The manage panel has been refreshed with the latest server data.",
  },
};

/**
 * Sends a DM to the user confirming which action was performed on their server.
 * Fails silently — DM failures (blocked DMs, missing intent) must never crash
 * or abort the button interaction that triggered them.
 */
async function sendActionDm(
  user: User,
  action: ManageAction,
  server: PterodactylServerAttributes,
  utilization: ServerUtilization | undefined,
): Promise<void> {
  try {
    const meta = ACTION_META[action];

    const embed = new EmbedBuilder()
      .setColor(meta.color)
      .setTitle(`${meta.emoji} ${meta.label}`)
      .setDescription(meta.description)
      .addFields(
        { name: `${EMOJIS.server} Server`, value: server.name, inline: true },
        { name: `${EMOJIS.link} Identifier`, value: `\`${server.identifier}\``, inline: true },
      );

    // Attach live stats when available
    if (utilization) {
      embed.addFields(
        {
          name: `${EMOJIS.cpu} CPU`,
          value: `${utilization.cpuAbsolute.toFixed(1)}%`,
          inline: true,
        },
        {
          name: `${EMOJIS.ram} RAM`,
          value: formatBytes(utilization.memoryBytes),
          inline: true,
        },
        {
          name: `${EMOJIS.disk} Disk`,
          value: formatBytes(utilization.diskBytes),
          inline: true,
        },
        {
          name: `${EMOJIS.uptime} Uptime`,
          value: utilization.state === "running" ? formatUptime(utilization.uptimeMs) : "—",
          inline: true,
        },
      );
    }

    embed
      .setFooter({ text: `${EMOJIS.notification} Pterodactyl Bot — Action Notification` })
      .setTimestamp();

    const dm = await user.createDM();
    await dm.send({ embeds: [embed] });
  } catch (err) {
    // DMs blocked or unavailable — log and continue silently
    logger.warn("Could not send action DM to user", { userId: user.id, err });
  }
}

// ── Command definition ────────────────────────────────────────────────────────

export const manageCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("manage")
    .setDescription("Manage a server \u2014 start, stop, restart, and more")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Server identifier, UUID, or ID")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("email")
        .setDescription("The panel account email registered to this server")
        .setRequired(true),
    ),
  adminOnly: false,
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const identifier = interaction.options.getString("server", true).trim();
    const email = interaction.options.getString("email", true).trim().toLowerCase();

    try {
      const server = await pterodactyl.getServerByIdentifier(identifier);
      if (!server) {
        await interaction.editReply({
          content: `${EMOJIS.cross} No server matching \`${identifier}\` was found.`,
        });
        return;
      }

      const admin = isAdmin(interaction);

      if (!admin) {
        const owner = await pterodactyl.getUser(server.user);
        if (!owner || owner.email.toLowerCase() !== email) {
          await interaction.editReply({
            content: `${EMOJIS.lock} That email doesn't match the account this server is registered to.`,
          });
          return;
        }
      }

      const embed = await buildManageEmbed(server);
      const components = buildManageRows(server, interaction.user.id);

      await interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      logger.error("Failed to load /manage panel", error);
      const message =
        error instanceof PterodactylApiError ? error.message : "Unexpected error contacting the panel.";
      await interaction.editReply({ content: `${EMOJIS.cross} Failed to load server: ${message}` });
    }
  },
};

// ── Button handler ────────────────────────────────────────────────────────────

const POWER_ACTIONS: Record<string, "start" | "stop" | "restart" | "kill"> = {
  start: "start",
  stop: "stop",
  restart: "restart",
  kill: "kill",
};

async function handleManageButton(interaction: ButtonInteraction): Promise<void> {
  const decoded = decodeCustomId(interaction.customId);
  if (!decoded) {
    return;
  }

  const { action, serverIdentifier, requesterId } = decoded;

  // Only the person who originally ran /manage can operate these buttons
  if (interaction.user.id !== requesterId) {
    await interaction.reply({
      content: `${EMOJIS.lock} Only the person who ran \`/manage\` can use these buttons.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const server = await pterodactyl.getServerByIdentifier(serverIdentifier);
    if (!server) {
      await interaction.reply({
        content: `${EMOJIS.cross} That server no longer exists.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ── Power actions (start / stop / restart / kill) ──────────────────────
    if (action in POWER_ACTIONS) {
      await interaction.deferUpdate();
      await sendPowerSignal(server.identifier, POWER_ACTIONS[action]!);
      logger.info(`Power signal '${action}' sent`, { by: requesterId, server: server.identifier });

      // Fetch utilization once — pass into embed builder so it is not called twice
      const utilization = await getServerUtilization(server.identifier);
      const embed = await buildManageEmbed(server, utilization);
      const components = buildManageRows(server, requesterId);

      // Interaction must be resolved before DM is sent
      await interaction.editReply({ embeds: [embed], components });

      // Fire-and-forget DM — failure must never affect the interaction
      void sendActionDm(interaction.user, action as ManageAction, server, utilization);
      return;
    }

    // ── Reinstall ──────────────────────────────────────────────────────────
    if (action === "reinstall") {
      await interaction.deferUpdate();
      await pterodactyl.reinstallServer(server.id);
      logger.info("Reinstall triggered", { by: requesterId, server: server.identifier });

      const embed = await buildManageEmbed(server);
      const components = buildManageRows(server, requesterId);

      await interaction.editReply({ embeds: [embed], components });

      // No stats during reinstall — server is wiping
      void sendActionDm(interaction.user, "reinstall", server, undefined);
      return;
    }

    // ── Stats / Refresh ────────────────────────────────────────────────────
    if (action === "stats" || action === "refresh") {
      await interaction.deferUpdate();

      // Fetch utilization once — reuse for both embed and DM
      const utilization = await getServerUtilization(server.identifier);
      const embed = await buildManageEmbed(server, utilization);
      const components = buildManageRows(server, requesterId);

      await interaction.editReply({ embeds: [embed], components });

      // Fire-and-forget DM with stats snapshot
      void sendActionDm(interaction.user, action, server, utilization);
      return;
    }
  } catch (error) {
    logger.error(`Failed to handle /manage button action '${action}'`, error);
    const message =
      error instanceof PterodactylApiError ? error.message : "Unexpected error contacting the panel.";
    const content = `${EMOJIS.cross} Action failed: ${message}`;

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  }
}

export const manageButtonHandler: ButtonHandler = {
  prefix: `${BUTTON_PREFIX}:`,
  execute: handleManageButton,
};
