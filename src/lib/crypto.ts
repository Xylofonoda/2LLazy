import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a hex string: iv(24chars) + authTag(32chars) + ciphertext(hex)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return (
    iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex")
  );
}

/**
 * Decrypts a hex string produced by encrypt().
 */
export function decrypt(encryptedHex: string): string {
  const key = getKey();
  const iv = Buffer.from(encryptedHex.slice(0, IV_LENGTH * 2), "hex");
  const tag = Buffer.from(
    encryptedHex.slice(IV_LENGTH * 2, IV_LENGTH * 2 + TAG_LENGTH * 2),
    "hex"
  );
  const ciphertext = Buffer.from(
    encryptedHex.slice(IV_LENGTH * 2 + TAG_LENGTH * 2),
    "hex"
  );

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return (
    decipher.update(ciphertext).toString("utf8") +
    decipher.final("utf8")
  );
}
