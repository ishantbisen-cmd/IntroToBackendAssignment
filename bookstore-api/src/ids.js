import { randomInt } from 'crypto';
import { httpError } from './errors.js';

const LOOKUP = {
  books: 'SELECT 1 AS ok FROM books WHERE id = ?',
  orders: 'SELECT 1 AS ok FROM orders WHERE id = ?',
  cart_items: 'SELECT 1 AS ok FROM cart_items WHERE id = ?',
  order_items: 'SELECT 1 AS ok FROM order_items WHERE id = ?'
};

export function newId(db, prefix, table) {
  const sql = LOOKUP[table];
  if (!sql) {
    throw new Error(`Refusing to mint an id for unknown table ${table}`);
  }

  const exists = db.prepare(sql);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = `${prefix}_${randomInt(10000, 99999)}`;
    if (!exists.get(id)) return id;
  }

  throw httpError(500, 'ID_GENERATION_FAILED', 'Could not allocate a new id.');
}

export function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
