import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, PterodactylApiError } from "../../services/pterodactyl";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:reinstall-server");

export const reinstallServerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("reinstall-server")
    .setDescription("[Owner] Reinstall a server")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Server identifier, UUID, or ID")
        .setRequired(true),
    ),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const identifier = interaction.options.getString("server", true);

    try {
      const server = await pterodactyl.getServerByIdentifier(identifier);
      if (!server) {
        await interaction.editReply({ content: `${EMOJIS.cross} No server matching \`${identifier}\` was found.` });
        return;
      }

      await pterodactyl.reinstallServer(server.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${EMOJIS.tools} Server Reinstall Started`)
        .setDescription(`**${server.name}** is now reinstalling. This may take a few minutes.`)
        .addFields({ name: "Identifier", value: `\`${server.identifier}\``, inline: true })
        .setTimestamp();

      let dmSent = false;
      try {
        const dm = await interaction.user.createDM();
        await dm.send({ embeds: [embed] });
        dmSent = true;
      } catch { /* DMs closed */ }

      if (dmSent) {
        await interaction.editReply({
          content: `${EMOJIS.success} Reinstall started. ${EMOJIS.notification} Check your DMs for details.`,
        });
      } else {
        await interaction.editReply({
          content: `${EMOJIS.warning} Reinstall started (your DMs are closed, showing here instead):`,
          embeds: [embed],
        });
      }
    } catch (error) {
      logger.error("Failed to reinstall server", error);
      const message = error instanceof PterodactylApiError ? error.message : "Unexpected error contacting the panel.";
      await interaction.editReply({ content: `${EMOJIS.cross} Failed to reinstall server: ${message}` });
    }
  },
};
