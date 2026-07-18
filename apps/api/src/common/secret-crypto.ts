import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getConfig } from '@footcast/config';

type EncryptedBlob = {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
  last4: string;
};

function keyBytes(): Buffer {
  const raw = getConfig().SECRETS_ENCRYPTION_KEY;
  const buf = Buffer.from(raw, raw.length === 64 ? 'hex' : 'utf8');
  if (buf.length >= 32) return buf.subarray(0, 32);
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const last4 = plain.length <= 4 ? '••••' : plain.slice(-4);
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    last4,
  };
}

export function decryptSecret(blob: unknown): string | null {
  if (!blob || typeof blob !== 'object') return null;
  const b = blob as Partial<EncryptedBlob>;
  if (b.v !== 1 || b.alg !== 'aes-256-gcm' || !b.iv || !b.tag || !b.ciphertext) {
    return null;
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyBytes(),
      Buffer.from(b.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(b.tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(b.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<EncryptedBlob>;
  return b.v === 1 && b.alg === 'aes-256-gcm' && typeof b.ciphertext === 'string';
}

export function maskSecretMeta(value: unknown): {
  configured: boolean;
  last4: string | null;
} {
  if (isEncryptedBlob(value)) {
    return { configured: true, last4: value.last4 ?? null };
  }
  if (typeof value === 'string' && value.length > 0) {
    return { configured: true, last4: value.slice(-4) };
  }
  return { configured: false, last4: null };
}
