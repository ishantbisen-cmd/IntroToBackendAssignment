import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { addToCart, getCart, getCartItem, removeCartItem } from '../services/cart.js';

export function createCartRouter(db) {
  const router = Router();

  router.get('/', requireAuth(db), (req, res) => {
    res.json(getCart(db, req.user.id));
  });

  router.post('/items', requireAuth(db), (req, res) => {
    const { created, item } = addToCart(db, req.user.id, req.body ?? {});
    if (created) {
      res.status(201).set('Location', `/v1/cart/items/${item.cartItemId}`).json(item);
      return;
    }
    res.status(200).json(item);
  });

  router.get('/items/:cartItemId', requireAuth(db), (req, res) => {
    res.json(getCartItem(db, req.user.id, req.params.cartItemId));
  });

  router.delete('/items/:cartItemId', requireAuth(db), (req, res) => {
    removeCartItem(db, req.user.id, req.params.cartItemId);
    res.status(204).send();
  });

  return router;
}
