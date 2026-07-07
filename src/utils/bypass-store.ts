/**
 * Persists which servers are exempt ("bypassed") from the automatic 24h
 * idle/runtime stop enforced by services/auto-stop.ts. Backed by a plain
 * JSON file (no database dependency) so a standalone copy of this bot keeps
 * working across restarts with zero extra setup.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "./logger";

const logger = createLogger("bypass-store");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const STORE_PATH = path.resolve(DATA_DIR, "bypass.json");

function normalize(identifier: string): string {
  return identifier.trim().toLowerCase();
}

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
    logger.error("Failed to persist bypass store", error);
  }
}

export function isBypassed(identifier: string): boolean {
  return readStore().has(normalize(identifier));
}

export function setBypass(identifier: string, on: boolean): void {
  const store = readStore();
  const key = normalize(identifier);

  if (on) {
    store.add(key);
  } else {
    store.delete(key);
  }

  writeStore(store);
}

export function listBypassed(): string[] {
  return [...readStore()];
}
