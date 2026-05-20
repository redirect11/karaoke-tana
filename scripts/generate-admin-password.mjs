import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output, argv, exit } from "node:process";
import { webcrypto } from "node:crypto";

const DEFAULT_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function getPositionalPassword() {
  return argv.slice(2).find((value) => !value.startsWith("--")) ?? null;
}

function parseIterations() {
  const raw = getArgValue("iterations");
  if (!raw) return DEFAULT_ITERATIONS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Valore iterations non valido. Usa un intero positivo.");
  }
  return value;
}

async function readPassword() {
  const fromArg = getArgValue("password") ?? getPositionalPassword();
  if (fromArg) return fromArg;
  const rl = createInterface({ input, output });
  try {
    return (await rl.question("Nuova password admin: ")).trim();
  } finally {
    rl.close();
  }
}

async function derivePasswordHash(password, salt, iterations) {
  const subtle = webcrypto.subtle;
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

async function main() {
  const password = await readPassword();
  if (!password) {
    throw new Error("Password mancante.");
  }

  const iterations = parseIterations();
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePasswordHash(password, salt, iterations);

  const payload = {
    password_salt: toBase64(salt),
    password_hash: toBase64(hash),
    password_iterations: iterations,
    password_hash_algo: "pbkdf2-sha256",
  };

  console.log(JSON.stringify(payload, null, 2));
  console.log("\nSQL di esempio:");
  console.log(
    `UPDATE admin_credentials
SET
  password_salt = '${payload.password_salt}',
  password_hash = '${payload.password_hash}',
  password_iterations = ${payload.password_iterations},
  password_hash_algo = '${payload.password_hash_algo}',
  active = true,
  updated_at = NOW()
WHERE active = true;`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  exit(1);
});
