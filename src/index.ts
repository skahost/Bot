import { createDiscordClient } from "./client";
import { commands } from "./commands";
import { registerCommands } from "./services/register-commands";
import { registerInteractionHandler } from "./handlers/interaction-create";
import { registerMessageHandler } from "./handlers/message-create";
import { registerReadyHandler } from "./handlers/ready";
import { registerConnectionHandlers } from "./handlers/connection";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { checkStartupLicense } from "./services/builtin-license";
import { startAutoStopMonitor } from "./services/auto-stop";
import { startWebServer } from "./web-server";

const BANNER = String.raw`
 ____  _  __    _    _   _ ____    _     ___  ____  ____    ____      _    _ ____  _   _    _    ___
/ ___|| |/ /   / \  | \ | |  _ \  | |   / _ \|  _ \|  _ \  |  _ \    / \  | | __ )| | | |  / \  |_ _|
\___ \| ' /   / _ \ |  \| | | | | | |  | | | | |_) | | | | | |_) |  / _ \ | |  _ \| |_| | / _ \  | |
 ___) | . \  / ___ \| |\  | |_| | | |__| |_| |  _ <| |_| | |  _ <  / ___ \| | |_) |  _  |/ ___ \ | |
|____/|_|\_\/_/   \_\_| \_|____/  |_____\___/|_| \_\____/  |_| \_\/_/   \_\_|____/|_| |_/_/   \_\___|

           SKA AND LORD RAJBHI (Pterodactyl Bot)
`;

/**
 * Verifies every required environment variable is present before touching
 * Discord or the panel at all, so misconfiguration fails fast with a clear
 * message printed straight to the console instead of an obscure crash
 * later. `env` itself throws on import if something required is missing,
 * so simply reading it here (already done at module load) is the check —
 * this just makes the "config looks fine" confirmation explicit and loud.
 */
function checkStartupConfig(): void {
  logger.info("Checking configuration file...");
  logger.info(`  Discord token: ${env.discordToken ? "set" : "missing"}`);
  logger.info(`  Discord client ID: ${env.discordClientId}`);
  logger.info(`  Pterodactyl panel URL: ${env.pterodactylPanelUrl}`);
  logger.info(`  Pterodactyl application API key: ${env.pterodactylApiKey ? "set" : "missing"}`);
  logger.info(
    `  Pterodactyl client API key: ${env.pterodactylClientApiKey ? "set" : "not set (power actions, live stats, and the 24h auto-stop will be disabled)"}`,
  );
  logger.info("Configuration file looks OK.");
}

async function main(): Promise<void> {
  console.log(BANNER);
  logger.info("Starting Pterodactyl Discord bot...");

  // Start the web server immediately so Render health checks pass
  // before Discord login or panel API calls have completed.
  startWebServer();

  checkStartupConfig();

  // Hard gate: the process must not load commands, build a client, or ever
  // reach Discord if the license key is missing or wrong. This runs before
  // anything else touches Discord.js or the panel API — if it fails, the
  // process exits and the rest of the bot never starts (i.e. it "crashes").
  const license = checkStartupLicense();
  if (!license.valid) {
    logger.error(
      `License check failed: ${license.reason ?? "unknown reason"}. Refusing to start.`,
    );
    console.error(
      "\n\u274c Invalid or missing license key. Set the correct LICENSE_KEY to continue.\n",
    );
    process.exit(1);
  }

  logger.info("License key valid. Continuing startup...");

  const client = createDiscordClient();

  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }

  registerConnectionHandlers(client);
  registerReadyHandler(client);
  registerInteractionHandler(client);
  registerMessageHandler(client);

  await registerCommands();
  await client.login(env.discordToken);

  startAutoStopMonitor();

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Never let an unexpected error crash the bot outright (per spec:
  // "Never crash due to API or network errors"). Log and keep running.
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
  });
}

main().catch((error) => {
  logger.error("Fatal error during startup", error);
  process.exit(1);
});
