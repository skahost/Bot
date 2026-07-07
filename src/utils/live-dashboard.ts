import type { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { STATUS_REFRESH_INTERVAL_MS } from "../config/env";
import { createLogger } from "./logger";

const logger = createLogger("live-dashboard");

/** How many refresh cycles a live dashboard keeps auto-updating before it stops (avoids leaking timers forever). */
const MAX_REFRESH_CYCLES = 40; // e.g. 40 * 30s = 20 minutes, or 40 * 40s = ~26.7 minutes

/**
 * Sends an embed and keeps it updated on a fixed interval by editing the
 * original reply (same message, never a new one). Used for /node and
 * /servers. Automatically stops after a bounded number of cycles or if the
 * message is deleted/inaccessible, so we never leak timers.
 */
export async function startLiveDashboard(
  interaction: ChatInputCommandInteraction,
  buildEmbed: () => Promise<EmbedBuilder>,
  intervalMs: number = STATUS_REFRESH_INTERVAL_MS,
): Promise<void> {
  const embed = await buildEmbed();
  await interaction.editReply({ embeds: [embed] });

  let cycles = 0;
  const interval = setInterval(() => {
    void (async () => {
      cycles += 1;
      if (cycles >= MAX_REFRESH_CYCLES) {
        clearInterval(interval);
        return;
      }

      try {
        const nextEmbed = await buildEmbed();
        await interaction.editReply({ embeds: [nextEmbed] });
      } catch (error) {
        logger.warn("Stopping live dashboard refresh after edit failure", {
          error: error instanceof Error ? error.message : String(error),
        });
        clearInterval(interval);
      }
    })();
  }, intervalMs);
}
