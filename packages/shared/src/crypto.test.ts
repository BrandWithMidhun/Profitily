import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret } from './crypto.js';

const TOKEN = 'shpat_super_secret_access_token_value_1234567890';

describe('secret encryption (AES-256-GCM)', () => {
  let prevKey: string | undefined;

  beforeAll(() => {
    prevKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'test-encryption-master-secret-at-least-32-chars';
  });

  afterAll(() => {
    if (prevKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = prevKey;
  });

  it('round-trips a secret', () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN);
  });

  it('produces a versioned blob and never embeds the plaintext', () => {
    const blob = encryptSecret(TOKEN);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob).not.toContain(TOKEN);
    expect(blob.split(':')).toHaveLength(4);
  });

  it('uses a fresh IV (two encrypts of the same plaintext differ)', () => {
    expect(encryptSecret(TOKEN)).not.toBe(encryptSecret(TOKEN));
  });

  it('throws when the ciphertext is tampered (auth tag fails)', () => {
    const [v, iv, tag, ct] = encryptSecret(TOKEN).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const flipped = Buffer.from(ct, 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    const tampered = [v, iv, tag, flipped.toString('base64url')].join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws when the auth tag is tampered', () => {
    const [v, iv, tag, ct] = encryptSecret(TOKEN).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const flipped = Buffer.from(tag, 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() =>
      decryptSecret([v, iv, flipped.toString('base64url'), ct].join(':')),
    ).toThrow();
  });

  it('throws when decrypting under a different key', () => {
    const blob = encryptSecret(TOKEN);
    process.env.ENCRYPTION_KEY = 'a-completely-different-master-secret-32+chars';
    try {
      expect(() => decryptSecret(blob)).toThrow();
    } finally {
      process.env.ENCRYPTION_KEY =
        'test-encryption-master-secret-at-least-32-chars';
    }
  });

  it('throws on a malformed blob', () => {
    expect(() => decryptSecret('not-a-valid-blob')).toThrow(/Malformed/);
    expect(() => decryptSecret('v1:only:three')).toThrow(/Malformed/);
  });

  it('throws on an unknown key version', () => {
    const [, iv, tag, ct] = encryptSecret(TOKEN).split(':');
    expect(() => decryptSecret(['v9', iv, tag, ct].join(':'))).toThrow(
      /Unknown encryption key version/,
    );
  });

  it('throws when the master secret is missing/too short', () => {
    process.env.ENCRYPTION_KEY = 'too-short';
    try {
      expect(() => encryptSecret(TOKEN)).toThrow(/too short/);
    } finally {
      process.env.ENCRYPTION_KEY =
        'test-encryption-master-secret-at-least-32-chars';
    }
  });
});
