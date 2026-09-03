import {
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = (await scryptAsync(
    password,
    salt,
    KEY_LENGTH,
  )) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedPassword: string,
) {
  const [algorithm, salt, storedKeyHex] =
    storedPassword.split("$");

  if (
    algorithm !== "scrypt" ||
    !salt ||
    !storedKeyHex ||
    !/^[a-f0-9]+$/i.test(storedKeyHex)
  ) {
    return false;
  }

  const storedKey = Buffer.from(storedKeyHex, "hex");

  if (storedKey.length !== KEY_LENGTH) {
    return false;
  }

  const suppliedKey = (await scryptAsync(
    password,
    salt,
    KEY_LENGTH,
  )) as Buffer;

  return timingSafeEqual(storedKey, suppliedKey);
}