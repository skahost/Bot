import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { pterodactyl } from "../../services/pterodactyl";
import { setBypass, isBypassed } from "../../utils/bypass-store";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";

const logger = createLogger("command:bypass");

export const bypassCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("bypass")
    .setDescription("[Admin] Exempt a server from the automatic 24h stop")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Server identifier, UUID, or ID")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("state")
        .setDescription("Turn the 24/7 bypass on or off")
        .setRequired(true)
        .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" }),
    ),
  adminOnly: true,
  async execute(interaction) {
    await interaction.deferReply(); // public in channel
    const identifier = interaction.options.getString("server", true);
    const state = interaction.options.getString("state", true);

    try {
      const server = await pterodactyl.getServerByIdentifier(identifier);
      if (!server) {
        await interaction.editReply({
          content: `${EMOJIS.cross} No server matching \`${identifier}\` was found.`,
        });
        return;
      }

      setBypass(server.uuid, state === "on");
      const bypassed = isBypassed(server.uuid);

      logger.info("Bypass toggled", {
        executedBy: interaction.user.id,
        server: server.identifier,
        bypassed,
      });

      const embed = new EmbedBuilder()
        .setColor(bypassed ? 0x57f287 : 0xfee75c)
        .setTitle(`${EMOJIS.bypass} 24/7 Bypass Updated`)
        .setDescription(
          bypassed
            ? `**${server.name}** will now stay online 24/7 and will no longer be auto-stopped after 24 hours.`
            : `**${server.name}** is no longer exempt \u2014 it will be auto-stopped after 24 continuous hours of runtime.`,
        )
        .addFields({ name: "Server", value: `\`${server.identifier}\``, inline: true })
        .setTimestamp();

      // Show in channel
      await interaction.editReply({ embeds: [embed] });

      // Also send to DM (fire-and-forget)
      interaction.user.createDM()
        .then((dm) => dm.send({ embeds: [embed] }))
        .catch(() => { /* DMs closed — ignore */ });
    } catch (error) {
      logger.error("Failed to toggle bypass", error);
      await interaction.editReply({
        content: `${EMOJIS.cross} Failed to update the bypass state. Please try again shortly.`,
      });
    }
  },
};
