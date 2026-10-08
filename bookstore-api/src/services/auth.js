import { randomBytes } from 'crypto';
import { httpError } from '../errors.js';
import { DUMMY_HASH, verifyPassword } from '../passwords.js';
import { assertObject, validationError } from '../validate.js';

const SESSION_SECONDS = 24 * 60 * 60;

export function login(db, body) {
  assertObject(body);

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const details = [];
  if (!email) details.push({ field: 'email', message: 'email is required.' });
  if (!password) details.push({ field: 'password', message: 'password is required.' });
  if (details.length > 0) throw validationError(details);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const matches = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !matches) {
    throw httpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.', []);
  }

  const now = new Date();
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').run(user.id, now.toISOString());

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    user.id,
    expiresAt
  );

  return {
    token,
    tokenType: 'Bearer',
    expiresIn: SESSION_SECONDS,
    user: {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}
