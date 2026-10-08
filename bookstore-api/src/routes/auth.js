import { Router } from 'express';
import { login } from '../services/auth.js';

export function createAuthRouter(db) {
  const router = Router();

  router.post('/login', (req, res) => {
    res.json(login(db, req.body ?? {}));
  });

  return router;
}
