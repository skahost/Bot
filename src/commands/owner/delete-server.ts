import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, PterodactylApiError } from "../../services/pterodactyl";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:delete-server");

export const deleteServerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("delete-server")
    .setDescription("[Owner] Permanently delete a server")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Server identifier, UUID, or ID")
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("force")
        .setDescription("Force-delete even if the daemon is unreachable")
        .setRequired(false),
    ),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const identifier = interaction.options.getString("server", true);
    const force = interaction.options.getBoolean("force") ?? false;

    try {
      const server = await pterodactyl.getServerByIdentifier(identifier);
      if (!server) {
        await interaction.editReply({ content: `${EMOJIS.cross} No server matching \`${identifier}\` was found.` });
        return;
      }

      await pterodactyl.deleteServer(server.id, force);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`${EMOJIS.bin} Server Deleted`)
        .setDescription(`**${server.name}** has been permanently deleted from the panel.`)
        .addFields({ name: "Identifier", value: `\`${server.identifier}\``, inline: true })
        .setTimestamp();

      // Send full details to DM; fall back to ephemeral embed if DMs blocked
      let dmSent = false;
      try {
        const dm = await interaction.user.createDM();
        await dm.send({ embeds: [embed] });
        dmSent = true;
      } catch { /* DMs closed */ }

      if (dmSent) {
        await interaction.editReply({
          content: `${EMOJIS.success} Server deleted. ${EMOJIS.notification} Check your DMs for details.`,
        });
      } else {
        await interaction.editReply({
          content: `${EMOJIS.warning} Server deleted (your DMs are closed, showing here instead):`,
          embeds: [embed],
        });
      }
    } catch (error) {
      logger.error("Failed to delete server", error);
      const message = error instanceof PterodactylApiError ? error.message : "Unexpected error contacting the panel.";
      await interaction.editReply({ content: `${EMOJIS.cross} Failed to delete server: ${message}` });
    }
  },
};
