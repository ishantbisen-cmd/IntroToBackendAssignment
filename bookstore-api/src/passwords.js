import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split(':');
  if (parts.length !== 2) return false;

  const [salt, hash] = parts;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// Used when the email is unknown, so the failure takes about as long as a real check.
export const DUMMY_HASH = hashPassword('timing-only-not-a-login');
