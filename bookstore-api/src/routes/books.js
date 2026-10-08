import { Router } from 'express';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import { createBook, deleteBook, getBook, listBooks, updateBookPrice } from '../services/books.js';

export function createBookRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(listBooks(db, req.query));
  });

  router.get('/:bookId', (req, res) => {
    res.json(getBook(db, req.params.bookId));
  });

  router.post('/', requireAuth(db), requireStaff, (req, res) => {
    const book = createBook(db, req.body ?? {});
    res.status(201).set('Location', `/v1/books/${book.bookId}`).json(book);
  });

  router.patch('/:bookId', requireAuth(db), requireStaff, (req, res) => {
    res.json(updateBookPrice(db, req.params.bookId, req.body ?? {}));
  });

  router.delete('/:bookId', requireAuth(db), requireStaff, (req, res) => {
    deleteBook(db, req.params.bookId);
    res.status(204).send();
  });

  return router;
}
