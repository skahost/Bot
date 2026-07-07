/**
 * Minimal, dependency-free structured logger.
 *
 * Pterodactyl egg containers capture stdout/stderr directly, so plain
 * timestamped console output is the most compatible and lightweight choice.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: LogLevel, scope: string, message: string): string {
  return `[${timestamp()}] [${level.toUpperCase()}] [${scope}] ${message}`;
}

export function createLogger(scope: string) {
  return {
    info(message: string, meta?: Record<string, unknown>) {
      console.log(format("info", scope, message), meta ?? "");
    },
    warn(message: string, meta?: Record<string, unknown>) {
      console.warn(format("warn", scope, message), meta ?? "");
    },
    error(message: string, error?: unknown) {
      console.error(format("error", scope, message), error ?? "");
    },
    debug(message: string, meta?: Record<string, unknown>) {
      if (process.env["NODE_ENV"] !== "production") {
        console.debug(format("debug", scope, message), meta ?? "");
      }
    },
  };
}

export const logger = createLogger("bot");
