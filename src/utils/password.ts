import crypto from "node:crypto";

/**
 * Generates a cryptographically secure random password suitable for a new
 * Pterodactyl panel account. Uses crypto.randomInt (CSPRNG, uniform
 * distribution) rather than Math.random, and guarantees at least one
 * character from each class so it passes typical panel password policies.
 */
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomChar(charset: string): string {
  return charset[crypto.randomInt(0, charset.length)] as string;
}

export function generateSecurePassword(length = 20): string {
  const required = [
    randomChar(LOWER),
    randomChar(UPPER),
    randomChar(DIGITS),
    randomChar(SYMBOLS),
  ];

  const remainingLength = Math.max(length - required.length, 0);
  const rest = Array.from({ length: remainingLength }, () => randomChar(ALL));

  const chars = [...required, ...rest];

  // Fisher-Yates shuffle using a CSPRNG so the guaranteed classes aren't
  // always in the same predictable positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = tmp;
  }

  return chars.join("");
}
