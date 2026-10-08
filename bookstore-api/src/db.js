import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './passwords.js';
import { timestamp } from './ids.js';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'staff'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT NOT NULL UNIQUE,
  price REAL NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  status TEXT NOT NULL CHECK (status IN ('available', 'discontinued')),
  category TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL,
  UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  total_amount REAL NOT NULL,
  full_name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (idempotency_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`;

// Demo accounts. These passwords are for local testing only.
const USERS = [
  {
    id: 'usr_2048',
    name: 'Meera Iyer',
    email: 'meera.iyer@booknook.example',
    password: 'meera123',
    role: 'customer'
  },
  {
    id: 'usr_2077',
    name: 'Rohit Menon',
    email: 'rohit.menon@booknook.example',
    password: 'rohit123',
    role: 'customer'
  },
  {
    id: 'usr_1001',
    name: 'Arjun Shah',
    email: 'arjun.shah@booknook.example',
    password: 'staff123',
    role: 'staff'
  }
];

const BOOKS = [
  {
    id: 'bk_1042',
    title: 'The Night Circus',
    author: 'Erin Morgenstern',
    isbn: '9780385534635',
    price: 499,
    stock: 8,
    status: 'available',
    category: 'fiction'
  },
  {
    id: 'bk_1108',
    title: 'Atomic Habits',
    author: 'James Clear',
    isbn: '9780735211292',
    price: 350,
    stock: 12,
    status: 'available',
    category: 'self-help'
  },
  {
    id: 'bk_1201',
    title: 'The Guide',
    author: 'R. K. Narayan',
    isbn: '9780143039648',
    price: 299,
    stock: 4,
    status: 'available',
    category: 'fiction'
  },
  {
    id: 'bk_1300',
    title: 'Old Atlas',
    author: 'Survey Office',
    isbn: '9780000001300',
    price: 150,
    stock: 2,
    status: 'discontinued',
    category: 'reference'
  }
];

function seed(db) {
  const insertUser = db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  );
  const insertBook = db.prepare(
    `INSERT INTO books (id, title, author, isbn, price, stock, status, category, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const createdAt = timestamp();

  db.exec('BEGIN');
  try {
    for (const user of USERS) {
      insertUser.run(user.id, user.name, user.email, hashPassword(user.password), user.role);
    }
    for (const book of BOOKS) {
      insertBook.run(
        book.id,
        book.title,
        book.author,
        book.isbn,
        book.price,
        book.stock,
        book.status,
        book.category,
        createdAt
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // already closed
    }
    throw err;
  }
}

export function openDatabase(filename = ':memory:') {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec(SCHEMA);

  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  if (count.total === 0) seed(db);
  return db;
}

export function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // SQLite rolls back on its own after some statement failures.
    }
    throw err;
  }
}
