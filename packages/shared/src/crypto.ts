/**
 * Secret-at-rest encryption (docs/13 §5). AES-256-GCM with a fresh 12-byte IV per call
 * and a 16-byte auth tag verified on decrypt (tamper → throw). Used for the Shopify
 * access token (TASK-010) and, later, other integration credentials.
 *
 * Blob layout (self-describing, single string — fits the `Store.accessToken` column):
 *   v<keyVersion>:<base64url(iv)>:<base64url(authTag)>:<base64url(ciphertext)>
 *
 * Key: the 32-byte AES key is DERIVED from `ENCRYPTION_KEY` (the secret-store master
 * secret, ≥32 chars) via HKDF-SHA256 — so the config contract is unchanged and the
 * master secret need not itself be exactly 32 bytes. `v<n>` is the key version: the
 * rotation seam. To rotate, add a new version to `MASTER_SECRET_ENV` keyed by version,
 * encrypt new writes with the highest version, and re-wrap old blobs (decrypt-old →
 * encrypt-new). No per-record data keys, no KMS — one secret-store master secret.
 */
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const CURRENT_KEY_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256
const HKDF_SALT = Buffer.from('profitily-secret-hkdf-salt-v1');
const HKDF_INFO = Buffer.from('profitily-secret-encryption');

/** Env var holding the master secret for each key version (rotation seam). */
const MASTER_SECRET_ENV: Readonly<Record<number, string>> = {
  1: 'ENCRYPTION_KEY',
};

function deriveKey(version: number): Buffer {
  const envName = MASTER_SECRET_ENV[version as keyof typeof MASTER_SECRET_ENV];
  if (envName === undefined) {
    throw new Error(`Unknown encryption key version: v${version}`);
  }
  // eslint-disable-next-line security/detect-object-injection -- envName is from the fixed MASTER_SECRET_ENV map, not user input
  const masterSecret = process.env[envName];
  if (typeof masterSecret !== 'string' || masterSecret.length < 32) {
    throw new Error(
      `${envName} is missing or too short (need ≥32 chars for AES-256 key derivation)`,
    );
  }
  return Buffer.from(
    hkdfSync('sha256', masterSecret, HKDF_SALT, HKDF_INFO, KEY_BYTES),
  );
}

const b64url = (buf: Buffer): string => buf.toString('base64url');
const fromB64url = (s: string): Buffer => Buffer.from(s, 'base64url');

/** Encrypt a UTF-8 secret. Returns the versioned blob string. Never logs input/output. */
export function encryptSecret(plaintext: string): string {
  const key = deriveKey(CURRENT_KEY_VERSION);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v${CURRENT_KEY_VERSION}:${b64url(iv)}:${b64url(tag)}:${b64url(ciphertext)}`;
}

/** Decrypt a blob produced by `encryptSecret`. Throws on tamper, wrong key, or malformed input. */
export function decryptSecret(blob: string): string {
  const parts = blob.split(':');
  const [versionTag, ivB64, tagB64, ctB64] = parts;
  if (
    parts.length !== 4 ||
    versionTag === undefined ||
    ivB64 === undefined ||
    tagB64 === undefined ||
    ctB64 === undefined ||
    !versionTag.startsWith('v')
  ) {
    throw new Error('Malformed secret blob');
  }
  const version = Number(versionTag.slice(1));
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Malformed secret blob: bad key version');
  }
  const iv = fromB64url(ivB64);
  const tag = fromB64url(tagB64);
  const ciphertext = fromB64url(ctB64);
  if (iv.length !== IV_BYTES) throw new Error('Malformed secret blob: bad IV');
  if (tag.length !== TAG_BYTES) {
    throw new Error('Malformed secret blob: bad auth tag');
  }
  const key = deriveKey(version);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  // final() throws if the auth tag does not verify (tamper / wrong key).
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  );
}
