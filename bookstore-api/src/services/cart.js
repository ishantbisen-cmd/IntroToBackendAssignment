import { httpError, insufficientStock, copyAvailability } from '../errors.js';
import { newId, money } from '../ids.js';
import { withTransaction } from '../db.js';
import { assertObject, readBookId, readQuantity, rejectClientPrice, validationError } from '../validate.js';

const MAX_PER_LINE = 10;

const CART_SELECT = `
  SELECT c.id, c.book_id, c.quantity, c.unit_price, b.title
  FROM cart_items c
  JOIN books b ON b.id = c.book_id
`;

function presentCartItem(row) {
  return {
    cartItemId: row.id,
    bookId: row.book_id,
    title: row.title,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: money(row.unit_price * row.quantity)
  };
}

function loadCartItem(db, userId, cartItemId) {
  return db.prepare(`${CART_SELECT} WHERE c.user_id = ? AND c.id = ?`).get(userId, cartItemId);
}

export function getCart(db, userId) {
  const rows = db.prepare(`${CART_SELECT} WHERE c.user_id = ? ORDER BY b.title`).all(userId);
  const items = rows.map(presentCartItem);
  const totalAmount = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
  return { items, totalAmount, currency: 'INR' };
}

export function getCartItem(db, userId, cartItemId) {
  const row = loadCartItem(db, userId, cartItemId);
  if (!row) {
    throw httpError(404, 'CART_ITEM_NOT_FOUND', 'That cart item does not exist on your cart.', []);
  }
  return presentCartItem(row);
}

function cartStockDetail(stock, already, requested) {
  if (already === 0) return copyAvailability(stock, requested);
  const room = Math.max(stock - already, 0);
  if (room === 0) {
    return `You already have ${already} in the cart and nothing more is in stock.`;
  }
  return `You already have ${already} in the cart. You can add ${room} more, not ${requested}.`;
}

export function addToCart(db, userId, body) {
  assertObject(body);
  rejectClientPrice(body);
  const bookId = readBookId(body.bookId);
  const quantity = readQuantity(body.quantity);

  if (quantity > MAX_PER_LINE) {
    throw validationError([
      {
        field: 'quantity',
        message: `quantity cannot be more than ${MAX_PER_LINE} copies in one add.`
      }
    ]);
  }

  return withTransaction(db, () => {
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

    const existing = db
      .prepare('SELECT * FROM cart_items WHERE user_id = ? AND book_id = ?')
      .get(userId, bookId);
    const already = existing ? existing.quantity : 0;
    const nextQty = already + quantity;

    if (nextQty > MAX_PER_LINE) {
      throw validationError([
        {
          field: 'quantity',
          message: `This add would make ${nextQty} copies. The limit is ${MAX_PER_LINE}.`,
          requested: nextQty,
          limit: MAX_PER_LINE
        }
      ]);
    }

    if (nextQty > book.stock) {
      throw insufficientStock({
        bookId,
        available: book.stock,
        requested: quantity,
        message: 'The cart was not updated because the requested quantity is no longer in stock.',
        detailMessage: cartStockDetail(book.stock, already, quantity)
      });
    }

    // Catalog price, refreshed on every add. The browser does not get to name a price.
    const unitPrice = money(book.price);
    let cartItemId;
    let created;

    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = ?, unit_price = ? WHERE id = ?').run(
        nextQty,
        unitPrice,
        existing.id
      );
      cartItemId = existing.id;
      created = false;
    } else {
      cartItemId = newId(db, 'ci', 'cart_items');
      db.prepare(
        `INSERT INTO cart_items (id, user_id, book_id, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`
      ).run(cartItemId, userId, bookId, nextQty, unitPrice);
      created = true;
    }

    return { created, item: presentCartItem(loadCartItem(db, userId, cartItemId)) };
  });
}

export function removeCartItem(db, userId, cartItemId) {
  const result = db
    .prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?')
    .run(cartItemId, userId);
  if (result.changes !== 1) {
    throw httpError(404, 'CART_ITEM_NOT_FOUND', 'That cart item does not exist on your cart.', []);
  }
}
