import { ActivityType, Events, type Client } from "discord.js";
import { pterodactyl } from "../services/pterodactyl";
import { createLogger } from "../utils/logger";

const logger = createLogger("ready-handler");

export function registerReadyHandler(client: Client): void {
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);

    void updatePresence(readyClient);
    setInterval(() => {
      void updatePresence(readyClient);
    }, 60_000);
  });
}

async function updatePresence(client: Client<true>): Promise<void> {
  try {
    const { online } = await pterodactyl.ping();
    client.user.setPresence({
      activities: [
        {
          name: online ? "your Pterodactyl panel" : "panel unreachable",
          type: ActivityType.Watching,
        },
      ],
      status: online ? "online" : "dnd",
    });
  } catch (error) {
    logger.warn("Failed to update presence", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
