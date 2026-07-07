/**
 * Enforces a 24-hour maximum continuous runtime on every server on the
 * panel: any server that has been running for 24h+ is automatically sent a
 * stop signal, unless an admin has exempted it with `/bypass <server> on`.
 *
 * Requires PTERODACTYL_CLIENT_API_KEY (same key /manage's Stats/power
 * buttons use) since server uptime is only available via the Client API's
 * resources endpoint. If that key isn't configured, this sweep silently
 * does nothing rather than failing the whole bot.
 */
import { pterodactyl, sendPowerSignal, getServerUtilization } from "./pterodactyl";
import { isBypassed } from "../utils/bypass-store";
import { env } from "../config/env";
import { createLogger } from "../utils/logger";

const logger = createLogger("auto-stop");

const MAX_RUNTIME_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

async function sweepServers(): Promise<void> {
  if (!env.pterodactylClientApiKey) {
    return;
  }

  try {
    const servers = await pterodactyl.listAllServers();

    for (const server of servers) {
      if (isBypassed(server.uuid) || isBypassed(server.identifier)) {
        continue;
      }

      const utilization = await getServerUtilization(server.identifier);
      if (!utilization || utilization.state !== "running") {
        continue;
      }

      if (utilization.uptimeMs >= MAX_RUNTIME_MS) {
        try {
          await sendPowerSignal(server.identifier, "stop");
          logger.info(
            `Auto-stopped server after 24h continuous runtime: ${server.name} (${server.identifier})`,
          );
        } catch (error) {
          logger.warn(`Failed to auto-stop server ${server.identifier}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } catch (error) {
    logger.error("Auto-stop sweep failed", error);
  }
}

export function startAutoStopMonitor(): void {
  if (!env.pterodactylClientApiKey) {
    logger.warn(
      "PTERODACTYL_CLIENT_API_KEY not set \u2014 the 24h auto-stop enforcement is disabled.",
    );
    return;
  }

  void sweepServers();
  setInterval(() => {
    void sweepServers();
  }, SWEEP_INTERVAL_MS);

  logger.info("24h auto-stop monitor started (checks every 10 minutes).");
}
