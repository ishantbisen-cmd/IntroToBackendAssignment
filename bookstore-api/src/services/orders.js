import { httpError, insufficientStock, copyAvailability } from '../errors.js';
import { newId, money, timestamp } from '../ids.js';
import { withTransaction } from '../db.js';
import {
  assertObject,
  readAddress,
  readBookId,
  readIdempotencyKey,
  readQuantity,
  rejectClientPrice
} from '../validate.js';

function presentOrder(order, items) {
  return {
    orderId: order.id,
    userId: order.user_id,
    status: order.status,
    items: items.map((item) => ({
      bookId: item.book_id,
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total
    })),
    shippingAddress: {
      fullName: order.full_name,
      line1: order.line1,
      line2: order.line2,
      city: order.city,
      state: order.state,
      postalCode: order.postal_code,
      country: order.country,
      phone: order.phone
    },
    currency: order.currency,
    totalAmount: order.total_amount,
    createdAt: order.created_at
  };
}

function loadItems(db, orderId) {
  return db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
}

function loadOrder(db, orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  return presentOrder(order, loadItems(db, orderId));
}

function assertCanReadUser(db, requester, userId) {
  if (requester.role !== 'staff' && requester.id !== userId) {
    throw httpError(403, 'FORBIDDEN', 'You can only view your own orders.', []);
  }
  if (requester.role === 'staff') {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw httpError(404, 'USER_NOT_FOUND', 'No user exists with that id.', [
        { field: 'userId', message: 'User not found.' }
      ]);
    }
  }
}

export function listOrdersForUser(db, requester, userId) {
  assertCanReadUser(db, requester, userId);
  const orders = db
    .prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(userId);
  return { orders: orders.map((row) => loadOrder(db, row.id)) };
}

export function getOrder(db, requester, orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    throw httpError(404, 'ORDER_NOT_FOUND', 'No order exists with that id.', []);
  }
  if (requester.role !== 'staff' && order.user_id !== requester.id) {
    throw httpError(403, 'FORBIDDEN', 'You can only view your own orders.', []);
  }
  return presentOrder(order, loadItems(db, orderId));
}

export function placeOrder(db, userId, body, idempotencyKey) {
  assertObject(body);
  rejectClientPrice(body);

  const bookId = readBookId(body.bookId);
  const quantity = readQuantity(body.quantity);
  const address = readAddress(body.shippingAddress);
  const key = readIdempotencyKey(idempotencyKey);
  const fingerprint = JSON.stringify({ bookId, quantity, address });

  return withTransaction(db, () => {
    if (key) {
      const saved = db
        .prepare(
          `SELECT status_code, response_json, request_fingerprint
           FROM idempotency_keys WHERE idempotency_key = ? AND user_id = ?`
        )
        .get(key, userId);

      if (saved) {
        if (saved.request_fingerprint !== fingerprint) {
          throw httpError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'This Idempotency-Key was already used with a different request body.',
            []
          );
        }
        return {
          replay: true,
          statusCode: saved.status_code,
          body: JSON.parse(saved.response_json)
        };
      }
    }

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    if (!book) {
      throw httpError(404, 'BOOK_NOT_FOUND', 'No book exists with that id.', [
        { field: 'bookId', message: 'Book not found.' }
      ]);
    }
    if (book.status !== 'available') {
      throw httpError(409, 'BOOK_NOT_SELLABLE', 'This book is not available for sale.', [
        { field: 'bookId', bookId, message: 'The book is discontinued or not yet on sale.' }
      ]);
    }

    const unitPrice = money(book.price);
    const lineTotal = money(unitPrice * quantity);

    // The WHERE clause is the stock check. If another order took the last copy, changes is 0.
    const updated = db
      .prepare('UPDATE books SET stock = stock - ? WHERE id = ? AND stock >= ?')
      .run(quantity, bookId, quantity);

    if (updated.changes !== 1) {
      const latest = db.prepare('SELECT stock FROM books WHERE id = ?').get(bookId);
      const available = latest ? latest.stock : 0;
      throw insufficientStock({
        bookId,
        available,
        requested: quantity,
        message: 'The order could not be placed because the requested quantity is no longer in stock.',
        detailMessage: copyAvailability(available, quantity)
      });
    }

    const orderId = newId(db, 'ord', 'orders');
    const createdAt = timestamp();

    db.prepare(
      `INSERT INTO orders (
         id, user_id, status, currency, total_amount,
         full_name, line1, line2, city, state, postal_code, country, phone, created_at
       ) VALUES (?, ?, 'confirmed', 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      userId,
      lineTotal,
      address.fullName,
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
      address.phone,
      createdAt
    );

    db.prepare(
      `INSERT INTO order_items (id, order_id, book_id, title, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(newId(db, 'oi', 'order_items'), orderId, bookId, book.title, quantity, unitPrice, lineTotal);

    const responseBody = loadOrder(db, orderId);

    if (key) {
      db.prepare(
        `INSERT INTO idempotency_keys (
           idempotency_key, user_id, status_code, response_json, request_fingerprint, created_at
         ) VALUES (?, ?, 201, ?, ?, ?)`
      ).run(key, userId, JSON.stringify(responseBody), fingerprint, createdAt);
    }

    return { replay: false, statusCode: 201, body: responseBody };
  });
}
