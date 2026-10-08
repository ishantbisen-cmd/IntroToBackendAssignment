import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOrder, listOrdersForUser, placeOrder } from '../services/orders.js';

export function createOrderRouter(db) {
  const router = Router();

  router.post('/', requireAuth(db), (req, res) => {
    const result = placeOrder(db, req.user.id, req.body ?? {}, req.get('Idempotency-Key'));
    if (result.replay) res.set('Idempotency-Replay', 'true');
    res
      .status(result.statusCode)
      .set('Location', `/v1/orders/${result.body.orderId}`)
      .json(result.body);
  });

  router.get('/:orderId', requireAuth(db), (req, res) => {
    res.json(getOrder(db, req.user, req.params.orderId));
  });

  return router;
}

export function createUserOrderRouter(db) {
  const router = Router();

  router.get('/:userId/orders', requireAuth(db), (req, res) => {
    res.json(listOrdersForUser(db, req.user, req.params.userId));
  });

  return router;
}
