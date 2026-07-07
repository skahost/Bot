import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, PterodactylApiError } from "../../services/pterodactyl";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:unsuspend-server");

export const unsuspendServerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unsuspend-server")
    .setDescription("[Owner] Unsuspend a server")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Server identifier, UUID, or ID")
        .setRequired(true),
    ),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply(); // public in channel
    const identifier = interaction.options.getString("server", true);

    try {
      const server = await pterodactyl.getServerByIdentifier(identifier);
      if (!server) {
        await interaction.editReply({ content: `${EMOJIS.cross} No server matching \`${identifier}\` was found.` });
        return;
      }

      await pterodactyl.unsuspendServer(server.id);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${EMOJIS.success} Server Unsuspended`)
        .setDescription(`**${server.name}** has been unsuspended and is accessible again.`)
        .addFields({ name: "Identifier", value: `\`${server.identifier}\``, inline: true })
        .setTimestamp();

      // Show in channel
      await interaction.editReply({ embeds: [embed] });

      // Also send to DM (fire-and-forget)
      interaction.user.createDM()
        .then((dm) => dm.send({ embeds: [embed] }))
        .catch(() => { /* DMs closed — ignore */ });
    } catch (error) {
      logger.error("Failed to unsuspend server", error);
      const message = error instanceof PterodactylApiError ? error.message : "Unexpected error contacting the panel.";
      await interaction.editReply({ content: `${EMOJIS.cross} Failed to unsuspend server: ${message}` });
    }
  },
};
