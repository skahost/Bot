import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { isOwner } from "../../utils/permissions";
import { addAdmin, removeAdmin } from "../../utils/admin-store";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:admin");

export const adminCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("[Admin] Grant or revoke bot admin access")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Grant a Discord user admin access to this bot")
        .addUserOption((option) =>
          option.setName("user").setDescription("The Discord user to make an admin").setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("revoke")
        .setDescription("Revoke a Discord user's admin access to this bot")
        .addUserOption((option) =>
          option.setName("user").setDescription("The Discord user to remove as admin").setRequired(true),
        ),
    ),
  adminOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);
    const target = interaction.options.getUser("user", true);

    if (isOwner(target.id)) {
      await interaction.reply({
        content: `${EMOJIS.lock} **${target.tag}** is a permanent bot owner (configured via OWNER_IDS) and can't be changed here.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let embed: EmbedBuilder;

    if (sub === "add") {
      addAdmin(target.id);
      logger.info("Admin granted", { by: interaction.user.id, target: target.id });

      embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${EMOJIS.admin} Admin Access Granted`)
        .setDescription(`**${target.tag}** can now use all admin-only commands.`)
        .setTimestamp();
    } else {
      const existed = removeAdmin(target.id);
      logger.info("Admin revoked", { by: interaction.user.id, target: target.id, existed });

      embed = new EmbedBuilder()
        .setColor(existed ? 0xed4245 : 0xfee75c)
        .setTitle(`${EMOJIS.admin} Admin Access Revoked`)
        .setDescription(
          existed
            ? `**${target.tag}** no longer has admin access to this bot.`
            : `**${target.tag}** was not an admin, nothing changed.`,
        )
        .setTimestamp();
    }

    // Show in channel (public)
    await interaction.reply({ embeds: [embed] });

    // Also send to DM (fire-and-forget)
    interaction.user.createDM()
      .then((dm) => dm.send({ embeds: [embed] }))
      .catch(() => { /* DMs closed — ignore */ });
  },
};
