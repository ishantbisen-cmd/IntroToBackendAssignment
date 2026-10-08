import { httpError, validationError } from '../errors.js';
import { newId, timestamp } from '../ids.js';
import { readPrice, readStock, readText } from '../validate.js';

function toBook(row) {
  return {
    bookId: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    price: row.price,
    stock: row.stock,
    status: row.status,
    category: row.category
  };
}

function likeContains(term) {
  const escaped = String(term).trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readPageNumber(value, fallback, field) {
  if (value === undefined || value === '') return fallback;
  if (!/^[1-9]\d*$/.test(String(value))) {
    throw validationError([{ field, message: `${field} must be a positive whole number.` }]);
  }
  return Number(value);
}

export function listBooks(db, query) {
  const where = [];
  const params = [];

  const title = one(query.title);
  const author = one(query.author);
  const category = one(query.category);
  const status = one(query.status);

  if (typeof title === 'string' && title.trim()) {
    where.push(`title LIKE ? ESCAPE '\\'`);
    params.push(likeContains(title));
  }
  if (typeof author === 'string' && author.trim()) {
    where.push(`author LIKE ? ESCAPE '\\'`);
    params.push(likeContains(author));
  }
  if (typeof category === 'string' && category.trim()) {
    where.push('category = ? COLLATE NOCASE');
    params.push(category.trim());
  }
  if (typeof status === 'string' && status.trim()) {
    if (status !== 'available' && status !== 'discontinued') {
      throw validationError([
        { field: 'status', message: 'status must be available or discontinued.' }
      ]);
    }
    where.push('status = ?');
    params.push(status);
  }

  const page = readPageNumber(one(query.page), 1, 'page');
  const limit = readPageNumber(one(query.limit), 20, 'limit');
  if (limit > 100) {
    throw validationError([{ field: 'limit', message: 'limit cannot be greater than 100.' }]);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS total FROM books ${clause}`).get(...params).total;
  const rows = db
    .prepare(
      `SELECT * FROM books ${clause} ORDER BY title COLLATE NOCASE, id LIMIT ? OFFSET ?`
    )
    .all(...params, limit, (page - 1) * limit);

  return {
    books: rows.map(toBook),
    page,
    limit,
    total
  };
}

export function getBook(db, bookId) {
  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!row) {
    throw httpError(404, 'BOOK_NOT_FOUND', 'No book exists with that id.', [
      { field: 'bookId', message: 'Book not found.' }
    ]);
  }
  return toBook(row);
}

function isbnConflict() {
  return httpError(409, 'ISBN_ALREADY_EXISTS', 'A book with this ISBN is already in the inventory.', [
    { field: 'isbn', message: 'ISBN must be unique.' }
  ]);
}

export function createBook(db, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'VALIDATION_ERROR', 'The request body must be a JSON object.', []);
  }

  const details = [];
  const title = readText(details, body, 'title', 200);
  const author = readText(details, body, 'author', 200);
  const isbn = readText(details, body, 'isbn', 32);
  const category = readText(details, body, 'category', 80);
  const stock = readStock(details, body.stock);

  let price = null;
  if (body.price === undefined) {
    details.push({ field: 'price', message: 'price is required.' });
  } else {
    try {
      price = readPrice(body.price);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        details.push(...err.details);
      } else {
        throw err;
      }
    }
  }

  if (details.length > 0) throw validationError(details);

  const existing = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn);
  if (existing) throw isbnConflict();

  const bookId = newId(db, 'bk', 'books');
  try {
    db.prepare(
      `INSERT INTO books (id, title, author, isbn, price, stock, status, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`
    ).run(bookId, title, author, isbn, price, stock, category, timestamp());
  } catch (err) {
    if (String(err.message).includes('books.isbn')) throw isbnConflict();
    throw err;
  }

  return getBook(db, bookId);
}

// Price only. A full replacement would be PUT and would resend every other field.
export function updateBookPrice(db, bookId, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError([]);
  }

  const extras = Object.keys(body).filter((key) => key !== 'price');
  if (extras.length > 0) {
    throw httpError(
      400,
      'VALIDATION_ERROR',
      'This endpoint only updates the price.',
      extras.map((field) => ({ field, message: 'This field cannot be changed here.' }))
    );
  }

  const price = readPrice(body.price);
  const result = db.prepare('UPDATE books SET price = ? WHERE id = ?').run(price, bookId);
  if (result.changes !== 1) {
    throw httpError(404, 'BOOK_NOT_FOUND', 'No book exists with that id.', [
      { field: 'bookId', message: 'Book not found.' }
    ]);
  }
  return getBook(db, bookId);
}

export function deleteBook(db, bookId) {
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(bookId);
  if (result.changes !== 1) {
    throw httpError(404, 'BOOK_NOT_FOUND', 'No book exists with that id.', [
      { field: 'bookId', message: 'Book not found.' }
    ]);
  }
}
