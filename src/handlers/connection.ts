import { Events, type Client } from "discord.js";
import { createLogger } from "../utils/logger";

const logger = createLogger("connection-handler");

/**
 * Discord.js's WebSocketManager already auto-reconnects on drops, but we
 * still want visibility into connection state changes and to make sure
 * unexpected errors never crash the process (per "never crash due to API
 * or network errors").
 */
export function registerConnectionHandlers(client: Client): void {
  client.on(Events.ShardDisconnect, (event, shardId) => {
    logger.warn(`Shard ${shardId} disconnected (code ${event.code}). Discord.js will attempt to reconnect automatically.`);
  });

  client.on(Events.ShardReconnecting, (shardId) => {
    logger.info(`Shard ${shardId} reconnecting to Discord...`);
  });

  client.on(Events.ShardResume, (shardId, replayedEvents) => {
    logger.info(`Shard ${shardId} resumed connection (replayed ${replayedEvents} events).`);
  });

  client.on(Events.ShardError, (error, shardId) => {
    logger.error(`Shard ${shardId} encountered a websocket error`, error);
  });

  client.on(Events.Error, (error) => {
    logger.error("Discord client error", error);
  });

  client.on(Events.Warn, (message) => {
    logger.warn(message);
  });
}
