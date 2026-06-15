import { randomBytes } from "node:crypto";

// Short, URL-safe, prefixed IDs (e.g. "run_k3f9a2..."), no extra deps.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function createId(prefix: string, size = 16): string {
  const bytes = randomBytes(size);
  let out = "";
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}_${out}`;
}
