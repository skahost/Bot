import { Events, MessageFlags, type Interaction } from "discord.js";
import type { AutocompleteInteraction, Client, Collection } from "discord.js";
import type { ButtonHandler, Command } from "../types";
import { isAdmin } from "../utils/permissions";
import { checkCooldown } from "../utils/cooldown";
import { createLogger } from "../utils/logger";
import { EMOJIS } from "../config/emojis";
import { manageButtonHandler } from "../commands/shared/manage";

const logger = createLogger("interaction-handler");

const buttonHandlers: ButtonHandler[] = [manageButtonHandler];

export function registerInteractionHandler(
  client: Client & { commands: Collection<string, Command> },
): void {
  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void handleInteraction(interaction, client);
  });
}

async function handleInteraction(
  interaction: Interaction,
  client: Client & { commands: Collection<string, Command> },
): Promise<void> {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction, client);
    return;
  }

  if (interaction.isButton()) {
    const handler = buttonHandlers.find((candidate) => interaction.customId.startsWith(candidate.prefix));
    if (handler) {
      try {
        await handler.execute(interaction);
      } catch (error) {
        logger.error(`Error handling button interaction ${interaction.customId}`, error);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  // In DMs only /manage is allowed — block everything else
  if (!interaction.guild && interaction.commandName !== "manage") {
    await interaction.reply({
      content: `${EMOJIS.lock} Only \`/manage\` works in DMs. Please use the bot inside the server for all other commands.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`Received unknown command: ${interaction.commandName}`);
    return;
  }

  if (command.adminOnly && !isAdmin(interaction)) {
    logger.info(
      `Ignored /${interaction.commandName} from non-admin user ${interaction.user.id} (${interaction.user.tag})`,
    );
    await interaction.reply({
      content: `${EMOJIS.lock} This command is restricted to admins only.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cooldown = checkCooldown(interaction.user.id, interaction.commandName);
  if (cooldown.onCooldown) {
    await interaction.reply({
      content: `${EMOJIS.reload} Please wait ${(cooldown.remainingMs / 1000).toFixed(1)}s before using this command again.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command /${interaction.commandName}`, error);

    const errorMessage = `${EMOJIS.cross} Something went wrong while running that command. Please try again shortly.`;

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      logger.error("Failed to send error response to user", replyError);
    }
  }
}

async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  client: Client & { commands: Collection<string, Command> },
): Promise<void> {
  // Autocomplete in DMs only makes sense for /manage
  if (!interaction.guild && interaction.commandName !== "manage") {
    await interaction.respond([]).catch(() => undefined);
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command?.autocomplete) {
    await interaction.respond([]).catch(() => undefined);
    return;
  }

  // Autocomplete requests bypass slash-command permission gating on
  // Discord's side, so the same adminOnly check used for execution must be
  // re-applied here — otherwise a non-admin could probe node/egg/allocation
  // names just by opening the command's option list.
  if (command.adminOnly && !isAdmin(interaction)) {
    await interaction.respond([]).catch(() => undefined);
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    logger.error(`Error handling autocomplete for /${interaction.commandName}`, error);
    await interaction.respond([]).catch(() => undefined);
  }
}
