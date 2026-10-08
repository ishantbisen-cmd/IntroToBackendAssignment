import { httpError } from '../errors.js';

export function requireAuth(db) {
  return function requireAuthMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      next(httpError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header. Expected a Bearer token.'));
      return;
    }

    const session = db
      .prepare(
        `SELECT s.token, s.expires_at, u.id AS user_id, u.role, u.name, u.email
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(match[1]);

    if (!session || session.expires_at <= new Date().toISOString()) {
      next(httpError(401, 'UNAUTHORIZED', 'The access token is missing, invalid, or expired.'));
      return;
    }

    req.user = {
      id: session.user_id,
      role: session.role,
      name: session.name,
      email: session.email
    };
    next();
  };
}

export function requireStaff(req, res, next) {
  if (!req.user || req.user.role !== 'staff') {
    next(httpError(403, 'FORBIDDEN', 'Only staff can change the book inventory.'));
    return;
  }
  next();
}
