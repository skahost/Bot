import { EMOJIS } from "../config/emojis";

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatMiB(mib: number): string {
  if (mib <= 0) return "Unlimited";
  if (mib >= 1024 * 1024) return `${(mib / 1024 / 1024).toFixed(1)} TB`;
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GB`;
  return `${mib.toFixed(0)} MB`;
}

export function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || seconds > 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

export function statusEmoji(online: boolean): string {
  return online ? EMOJIS.online : EMOJIS.cross;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}

const SERVER_STATE_LABELS: Record<string, string> = {
  running: `${EMOJIS.online} Running`,
  starting: `${EMOJIS.reload} Starting`,
  stopping: `${EMOJIS.reload} Stopping`,
  offline: `${EMOJIS.cross} Offline`,
};

export function formatServerState(state: string | undefined): string {
  if (!state) return `${EMOJIS.cross} Unknown`;
  return SERVER_STATE_LABELS[state] ?? `${EMOJIS.cross} ${state}`;
}

/**
 * Renders a Unicode progress bar.
 * @param pct  Percentage (0–100). Values > 100 are clamped.
 * @param len  Total bar character length (default 14).
 */
export function progressBar(pct: number, len = 14): string {
  const filled = Math.round(Math.min(Math.max(pct, 0), 100) / 100 * len);
  return "\u2588".repeat(filled) + "\u2591".repeat(len - filled);
}

/**
 * Full resource bar line: `[bar] used / total (pct%)`
 * total = 0 means unlimited — shows a full bar with "Unlimited" label.
 */
export function resourceBar(
  usedBytes: number,
  totalMiB: number,
  label: string,
  emoji: string,
): string {
  if (totalMiB <= 0) {
    const bar = progressBar(100);
    return `${emoji} ${label}: \`${bar}\` ${formatBytes(usedBytes)} / Unlimited`;
  }
  const totalBytes = totalMiB * 1024 * 1024;
  const pct = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const bar = progressBar(pct);
  return `${emoji} ${label}: \`${bar}\` ${formatBytes(usedBytes)} / ${formatMiB(totalMiB)} (${pct.toFixed(1)}%)`;
}

/**
 * CPU bar line: `[bar] usedPct% / limitPct% (pct%)`
 * limitPct = 0 means unlimited.
 */
export function cpuBar(usedPct: number, limitPct: number, emoji: string): string {
  if (limitPct <= 0) {
    const bar = progressBar(usedPct);
    return `${emoji} CPU: \`${bar}\` ${usedPct.toFixed(1)}% / Unlimited`;
  }
  const pct = Math.min((usedPct / limitPct) * 100, 100);
  const bar = progressBar(pct);
  return `${emoji} CPU: \`${bar}\` ${usedPct.toFixed(1)}% / ${limitPct}% (${pct.toFixed(1)}%)`;
}
