/**
 * Offline, self-contained license gate.
 *
 * This is the hard startup gate: the process refuses to load commands or
 * log in to Discord at all unless the exact license key configured for this
 * build is present (via the LICENSE_KEY environment variable or
 * license.json). The check is a simple constant-time string comparison —
 * there is no database and no signing involved, so this works standalone on
 * any host (including a plain Pterodactyl "Generic Node.js" egg).
 */
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../utils/logger";

const logger = createLogger("license-gate");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/index.js lives at artifacts/discord-bot/dist, so ../license.json
// resolves to artifacts/discord-bot/license.json regardless of cwd.
const LICENSE_JSON_PATH = path.resolve(__dirname, "../license.json");

/** The single valid license key for this build. */
const REQUIRED_LICENSE_KEY = "k9#zP+qzw!Rt7";

export interface LicenseCheckResult {
  valid: boolean;
  reason?: string;
}

function loadRawLicenseKey(): string | null {
  const fromEnv = process.env["LICENSE_KEY"]?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const raw = readFileSync(LICENSE_JSON_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { licenseKey?: unknown };
    if (typeof parsed.licenseKey === "string" && parsed.licenseKey.trim().length > 0) {
      return parsed.licenseKey.trim();
    }
    return null;
  } catch {
    return null;
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    // Still run a comparison of equal-length buffers so this doesn't leak
    // timing information about the length mismatch itself being the reason.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

export function verifyLicenseKey(key: string): LicenseCheckResult {
  if (!safeCompare(key.trim(), REQUIRED_LICENSE_KEY)) {
    return { valid: false, reason: "License key is incorrect." };
  }

  return { valid: true };
}

export function checkStartupLicense(): LicenseCheckResult {
  const key = loadRawLicenseKey();

  if (!key) {
    return {
      valid: false,
      reason: "No license key found (set LICENSE_KEY or create license.json).",
    };
  }

  const result = verifyLicenseKey(key);
  if (!result.valid) {
    logger.error(result.reason ?? "License key invalid");
  }
  return result;
}
