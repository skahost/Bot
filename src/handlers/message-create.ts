import { Events, type Client, type Message } from "discord.js";
import { PREFIX } from "../config/prefix";
import { buildHelpEmbed } from "../commands/general/help";
import { isAdminMember } from "../utils/permissions";
import { checkCooldown } from "../utils/cooldown";
import { createLogger } from "../utils/logger";
import { EMOJIS } from "../config/emojis";

const logger = createLogger("message-handler");

export function registerMessageHandler(client: Client): void {
  client.on(Events.MessageCreate, (message: Message) => {
    void handleMessage(message);
  });
}

async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) {
    return;
  }

  // In DMs, only /manage is allowed — block prefix commands too
  if (!message.guild) {
    return;
  }

  if (!message.content.toLowerCase().startsWith(`${PREFIX}help`)) {
    return;
  }

  const cooldown = checkCooldown(message.author.id, "*help");
  if (cooldown.onCooldown) {
    await message.reply({
      content: `${EMOJIS.reload} Please wait ${(cooldown.remainingMs / 1000).toFixed(1)}s before using this command again.`,
    });
    return;
  }

  try {
    const callerIsAdmin = isAdminMember(message.author.id, message.member);
    await message.reply({ embeds: [buildHelpEmbed(callerIsAdmin)] });
  } catch (error) {
    logger.error(`Error executing ${PREFIX}help`, error);
    await message.reply({
      content: `${EMOJIS.cross} Something went wrong while running that command. Please try again shortly.`,
    });
  }
}
