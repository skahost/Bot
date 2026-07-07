import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { EMOJIS } from "../../config/emojis";
import { isAdmin } from "../../utils/permissions";

const USER_COMMANDS = [
  ["/help", "Show this command list"],
  ["/manage <server> <email>", "Start, stop, restart, kill, reinstall, view stats, or open the panel for a server"],
];

const ADMIN_COMMANDS = [
  ["/ping", "Show bot, API, and connection latency"],
  ["/status", "Live bot/panel/API status dashboard (auto-refreshes every 30s)"],
  ["/node", "Live dashboard for all nodes — status + RAM/CPU/Disk (auto-refreshes every 30s)"],
  ["/nodes", "All nodes with live RAM/CPU/Disk stats (auto-refreshes every 30s)"],
  ["/servers", "All servers with email, UUID, identifier, and online/offline status (auto-refreshes every 30s)"],
  ["/server-info <server>", "Show detailed info for one server"],
  ["/list-servers", "All servers with live RAM/CPU/Disk usage (auto-refreshes every 30s)"],
  ["/create-server", "Create a new server"],
  ["/delete-server <server>", "Permanently delete a server"],
  ["/suspend-server <server>", "Suspend a server"],
  ["/unsuspend-server <server>", "Unsuspend a server"],
  ["/reinstall-server <server>", "Reinstall a server"],
  ["/bypass <server> <on/off>", "Exempt a server from the automatic 24h stop"],
  ["/admin add <user>", "Grant a Discord user admin access to this bot"],
  ["/admin revoke <user>", "Revoke a Discord user's admin access to this bot"],
];

export function buildHelpEmbed(isCallerAdmin: boolean): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${EMOJIS.bluewings} Pterodactyl Control Bot \u2014 Commands`)
    .setDescription("Manage your Pterodactyl panel directly from Discord.")
    .addFields({
      name: `${EMOJIS.user} User`,
      value: USER_COMMANDS.map(([cmd, desc]) => `\`${cmd}\` \u2014 ${desc}`).join("\n"),
    });

  if (isCallerAdmin) {
    embed.addFields({
      name: `${EMOJIS.admin} Admin`,
      value: ADMIN_COMMANDS.map(([cmd, desc]) => `\`${cmd}\` \u2014 ${desc}`).join("\n"),
    });
  }

  embed
    .addFields({
      name: "Prefix Commands",
      value: "`*help` \u2014 Show this command list without using slash commands",
    })
    .setFooter({ text: "Data refreshes live from your Pterodactyl panel. \u2022 Made by LORD_RAJBHAI" })
    .setTimestamp();

  return embed;
}

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available commands"),
  adminOnly: true,
  async execute(interaction) {
    await interaction.reply({ embeds: [buildHelpEmbed(isAdmin(interaction))] });
  },
};
