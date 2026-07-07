/**
 * Persists Discord user IDs that were granted admin access at runtime via
 * `/admin add`. Backed by a plain JSON file (no database dependency) so a
 * standalone copy of this bot keeps working across restarts with zero extra
 * setup. Combined with the static OWNER_IDS env var, this is the full set of
 * admins — Discord server roles/permissions are intentionally NOT consulted.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "./logger";

const logger = createLogger("admin-store");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const STORE_PATH = path.resolve(DATA_DIR, "admins.json");

function readStore(): Set<string> {
  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function writeStore(store: Set<string>): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(STORE_PATH, JSON.stringify([...store], null, 2), "utf-8");
  } catch (error) {
    logger.error("Failed to persist admin store", error);
  }
}

export function isDynamicAdmin(userId: string): boolean {
  return readStore().has(userId);
}

export function addAdmin(userId: string): void {
  const store = readStore();
  store.add(userId);
  writeStore(store);
}

export function removeAdmin(userId: string): boolean {
  const store = readStore();
  const existed = store.delete(userId);
  writeStore(store);
  return existed;
}

export function listDynamicAdmins(): string[] {
  return [...readStore()];
}
