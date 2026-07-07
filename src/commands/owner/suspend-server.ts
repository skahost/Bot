import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, PterodactylApiError } from "../../services/pterodactyl";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:suspend-server");

export const suspendServerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("suspend-server")
    .setDescription("[Owner] Suspend a server")
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

      await pterodactyl.suspendServer(server.id);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`${EMOJIS.lock} Server Suspended`)
        .setDescription(`**${server.name}** has been suspended.`)
        .addFields({ name: "Identifier", value: `\`${server.identifier}\``, inline: true })
        .setTimestamp();

      // Show in channel
      await interaction.editReply({ embeds: [embed] });

      // Also send to DM (fire-and-forget)
      interaction.user.createDM()
        .then((dm) => dm.send({ embeds: [embed] }))
        .catch(() => { /* DMs closed — ignore */ });
    } catch (error) {
      logger.error("Failed to suspend server", error);
      const message = error instanceof PterodactylApiError ? error.message : "Unexpected error contacting the panel.";
      await interaction.editReply({ content: `${EMOJIS.cross} Failed to suspend server: ${message}` });
    }
  },
};
