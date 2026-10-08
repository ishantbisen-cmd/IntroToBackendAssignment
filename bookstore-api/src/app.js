import express from 'express';
import { errorHandler } from './errors.js';
import { createAuthRouter } from './routes/auth.js';
import { createBookRouter } from './routes/books.js';
import { createCartRouter } from './routes/cart.js';
import { createOrderRouter, createUserOrderRouter } from './routes/orders.js';

// Request path: route -> service (auth, stock, price rules) -> SQLite.
// Routes choose the status code. Services decide whether the action is allowed.
export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('json spaces', 2);

  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
      });
      next();
    });
  }

  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => {
    res.json({
      name: 'Online Bookstore API',
      version: 'v1',
      health: '/health'
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/v1/auth', createAuthRouter(db));
  app.use('/v1/books', createBookRouter(db));
  app.use('/v1/cart', createCartRouter(db));
  app.use('/v1/orders', createOrderRouter(db));
  app.use('/v1/users', createUserOrderRouter(db));

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'No route matches this path.',
        status: 404,
        details: []
      }
    });
  });

  app.use(errorHandler);
  return app;
}
