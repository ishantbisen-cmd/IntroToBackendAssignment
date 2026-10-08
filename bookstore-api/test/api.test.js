import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';

process.env.NODE_ENV = 'test';

const address = {
  fullName: 'Meera Iyer',
  line1: '14 Lake View Road',
  line2: 'Flat 3B',
  city: 'Pune',
  state: 'Maharashtra',
  postalCode: '411001',
  country: 'IN',
  phone: '+919800011122'
};

function assertError(json, status, code) {
  assert.ok(json && json.error, 'expected an error envelope');
  assert.equal(json.error.status, status);
  assert.equal(json.error.code, code);
  assert.equal(typeof json.error.message, 'string');
  assert.ok(json.error.message.length > 0);
  assert.ok(Array.isArray(json.error.details));
}

async function api(port, method, urlPath, { token, body, headers } = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  if (text) json = JSON.parse(text);
  return { status: res.status, json, headers: res.headers };
}

describe('Bookstore API', { concurrency: false }, () => {
  let db;
  let server;
  let port;
  let meera;
  let rohit;
  let staff;

  before(async () => {
    db = openDatabase(':memory:');
    const app = createApp(db);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    port = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
    if (db) db.close();
  });

  it('logs the demo users in', async () => {
    const bad = await api(port, 'POST', '/v1/auth/login', {
      body: { email: 'meera.iyer@booknook.example', password: 'wrong-password' }
    });
    assert.equal(bad.status, 401);
    assertError(bad.json, 401, 'INVALID_CREDENTIALS');

    const customer = await api(port, 'POST', '/v1/auth/login', {
      body: { email: 'meera.iyer@booknook.example', password: 'meera123' }
    });
    assert.equal(customer.status, 200);
    assert.equal(customer.json.tokenType, 'Bearer');
    assert.equal(customer.json.user.userId, 'usr_2048');
    assert.equal(customer.json.user.role, 'customer');
    meera = customer.json.token;

    const other = await api(port, 'POST', '/v1/auth/login', {
      body: { email: 'rohit.menon@booknook.example', password: 'rohit123' }
    });
    assert.equal(other.status, 200);
    rohit = other.json.token;

    const staffLogin = await api(port, 'POST', '/v1/auth/login', {
      body: { email: 'arjun.shah@booknook.example', password: 'staff123' }
    });
    assert.equal(staffLogin.status, 200);
    assert.equal(staffLogin.json.user.role, 'staff');
    staff = staffLogin.json.token;
  });

  it('lists books and fetches one book without a token', async () => {
    const list = await api(port, 'GET', '/v1/books');
    assert.equal(list.status, 200);
    assert.equal(list.json.total, 4);
    assert.ok(list.json.books.some((book) => book.bookId === 'bk_1042'));

    const filtered = await api(port, 'GET', '/v1/books?author=Morgenstern');
    assert.equal(filtered.status, 200);
    assert.equal(filtered.json.total, 1);
    assert.equal(filtered.json.books[0].title, 'The Night Circus');
    assert.equal(filtered.json.books[0].price, 499);

    const fiction = await api(port, 'GET', '/v1/books?category=fiction');
    assert.equal(fiction.json.total, 2);

    const one = await api(port, 'GET', '/v1/books/bk_1042');
    assert.equal(one.status, 200);
    assert.equal(one.json.author, 'Erin Morgenstern');
    assert.equal(one.json.stock, 8);

    const missing = await api(port, 'GET', '/v1/books/bk_missing');
    assert.equal(missing.status, 404);
    assertError(missing.json, 404, 'BOOK_NOT_FOUND');
  });

  it('lets only staff create, reprice, and delete books', async () => {
    const noToken = await api(port, 'POST', '/v1/books', {
      body: {
        title: 'Draft',
        author: 'A',
        isbn: '9780000000001',
        price: 100,
        stock: 1,
        category: 'fiction'
      }
    });
    assert.equal(noToken.status, 401);
    assertError(noToken.json, 401, 'UNAUTHORIZED');

    const customer = await api(port, 'POST', '/v1/books', {
      token: meera,
      body: {
        title: 'Draft',
        author: 'A',
        isbn: '9780000000001',
        price: 100,
        stock: 1,
        category: 'fiction'
      }
    });
    assert.equal(customer.status, 403);
    assertError(customer.json, 403, 'FORBIDDEN');

    const created = await api(port, 'POST', '/v1/books', {
      token: staff,
      body: {
        title: 'Coastal Birds',
        author: 'L. DSouza',
        isbn: '9780000009911',
        price: 275.5,
        stock: 3,
        category: 'nature'
      }
    });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('location'), `/v1/books/${created.json.bookId}`);
    assert.equal(created.json.price, 275.5);
    assert.equal(created.json.status, 'available');

    const priced = await api(port, 'PATCH', `/v1/books/${created.json.bookId}`, {
      token: staff,
      body: { price: 250 }
    });
    assert.equal(priced.status, 200);
    assert.equal(priced.json.price, 250);
    assert.equal(priced.json.title, 'Coastal Birds');

    const pricedAgain = await api(port, 'PATCH', `/v1/books/${created.json.bookId}`, {
      token: staff,
      body: { price: 250 }
    });
    assert.equal(pricedAgain.status, 200);
    assert.equal(pricedAgain.json.price, 250);

    const extraField = await api(port, 'PATCH', `/v1/books/${created.json.bookId}`, {
      token: staff,
      body: { price: 10, title: 'Renamed' }
    });
    assert.equal(extraField.status, 400);
    assert.equal(extraField.json.error.details[0].field, 'title');

    const duplicate = await api(port, 'POST', '/v1/books', {
      token: staff,
      body: {
        title: 'Another copy',
        author: 'L. DSouza',
        isbn: '9780000009911',
        price: 10,
        stock: 1,
        category: 'nature'
      }
    });
    assert.equal(duplicate.status, 409);
    assertError(duplicate.json, 409, 'ISBN_ALREADY_EXISTS');

    const removed = await api(port, 'DELETE', `/v1/books/${created.json.bookId}`, { token: staff });
    assert.equal(removed.status, 204);
    assert.equal(removed.json, null);

    const removedAgain = await api(port, 'DELETE', `/v1/books/${created.json.bookId}`, { token: staff });
    assert.equal(removedAgain.status, 404);
    assertError(removedAgain.json, 404, 'BOOK_NOT_FOUND');
  });

  it('adds to the cart, then refuses stock and discontinued books', async () => {
    const naked = await api(port, 'POST', '/v1/cart/items', {
      body: { bookId: 'bk_1042', quantity: 1 }
    });
    assert.equal(naked.status, 401);

    const first = await api(port, 'POST', '/v1/cart/items', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 2 }
    });
    assert.equal(first.status, 201);
    assert.equal(first.json.bookId, 'bk_1042');
    assert.equal(first.json.quantity, 2);
    assert.equal(first.json.unitPrice, 499);
    assert.equal(first.json.lineTotal, 998);
    assert.equal(first.headers.get('location'), `/v1/cart/items/${first.json.cartItemId}`);

    const second = await api(port, 'POST', '/v1/cart/items', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 2 }
    });
    assert.equal(second.status, 200);
    assert.equal(second.json.cartItemId, first.json.cartItemId);
    assert.equal(second.json.quantity, 4);

    const overLimit = await api(port, 'POST', '/v1/cart/items', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 7 }
    });
    assert.equal(overLimit.status, 400);
    assertError(overLimit.json, 400, 'VALIDATION_ERROR');
    assert.equal(overLimit.json.error.details[0].field, 'quantity');

    const pricedByClient = await api(port, 'POST', '/v1/cart/items', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 1, unitPrice: 1 }
    });
    assert.equal(pricedByClient.status, 400);
    assertError(pricedByClient.json, 400, 'PRICE_NOT_ACCEPTED');

    const discontinued = await api(port, 'POST', '/v1/cart/items', {
      token: meera,
      body: { bookId: 'bk_1300', quantity: 1 }
    });
    assert.equal(discontinued.status, 409);
    assertError(discontinued.json, 409, 'BOOK_NOT_SELLABLE');

    const cart = await api(port, 'GET', '/v1/cart', { token: meera });
    assert.equal(cart.status, 200);
    assert.equal(cart.json.items.length, 1);
    assert.equal(cart.json.totalAmount, 1996);
    assert.equal(cart.json.currency, 'INR');

    const book = await api(port, 'GET', '/v1/books/bk_1042');
    assert.equal(book.json.stock, 8);
  });

  it('places an order at the catalog price and rejects bad input', async () => {
    const missingToken = await api(port, 'POST', '/v1/orders', {
      body: { bookId: 'bk_1042', quantity: 2, shippingAddress: address }
    });
    assert.equal(missingToken.status, 401);

    const badQty = await api(port, 'POST', '/v1/orders', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: '2', shippingAddress: address }
    });
    assert.equal(badQty.status, 400);
    assertError(badQty.json, 400, 'VALIDATION_ERROR');
    assert.equal(badQty.json.error.details[0].field, 'quantity');

    const withPrice = await api(port, 'POST', '/v1/orders', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 2, unitPrice: 1, shippingAddress: address }
    });
    assert.equal(withPrice.status, 400);
    assertError(withPrice.json, 400, 'PRICE_NOT_ACCEPTED');

    const created = await api(port, 'POST', '/v1/orders', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 2, shippingAddress: address }
    });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('location'), `/v1/orders/${created.json.orderId}`);
    assert.equal(created.json.userId, 'usr_2048');
    assert.equal(created.json.status, 'confirmed');
    assert.equal(created.json.currency, 'INR');
    assert.equal(created.json.totalAmount, 998);
    assert.equal(created.json.items.length, 1);
    assert.equal(created.json.items[0].bookId, 'bk_1042');
    assert.equal(created.json.items[0].title, 'The Night Circus');
    assert.equal(created.json.items[0].quantity, 2);
    assert.equal(created.json.items[0].unitPrice, 499);
    assert.equal(created.json.items[0].lineTotal, 998);
    assert.deepEqual(created.json.shippingAddress, address);
    assert.match(created.json.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

    const afterOrder = await api(port, 'GET', '/v1/books/bk_1042');
    assert.equal(afterOrder.json.stock, 6);

    const follow = await api(port, 'GET', `/v1/orders/${created.json.orderId}`, { token: meera });
    assert.equal(follow.status, 200);
    assert.equal(follow.json.orderId, created.json.orderId);

    const stolen = await api(port, 'GET', `/v1/orders/${created.json.orderId}`, { token: rohit });
    assert.equal(stolen.status, 403);
    assertError(stolen.json, 403, 'FORBIDDEN');

    const mine = await api(port, 'GET', '/v1/users/usr_2048/orders', { token: meera });
    assert.equal(mine.status, 200);
    assert.equal(mine.json.orders.length, 1);
    assert.equal(mine.json.orders[0].orderId, created.json.orderId);

    const theirs = await api(port, 'GET', '/v1/users/usr_2048/orders', { token: rohit });
    assert.equal(theirs.status, 403);

    const asStaff = await api(port, 'GET', '/v1/users/usr_2048/orders', { token: staff });
    assert.equal(asStaff.status, 200);
    assert.equal(asStaff.json.orders.length, 1);

    const empty = await api(port, 'GET', '/v1/users/usr_2077/orders', { token: rohit });
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.json.orders, []);
  });

  it('returns 409 when the requested quantity is no longer in stock', async () => {
    db.prepare('UPDATE books SET stock = 1 WHERE id = ?').run('bk_1042');

    const conflict = await api(port, 'POST', '/v1/orders', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 2, shippingAddress: address }
    });
    assert.equal(conflict.status, 409);
    assertError(conflict.json, 409, 'INSUFFICIENT_STOCK');
    assert.equal(
      conflict.json.error.message,
      'The order could not be placed because the requested quantity is no longer in stock.'
    );
    assert.equal(conflict.json.error.details[0].field, 'quantity');
    assert.equal(conflict.json.error.details[0].bookId, 'bk_1042');
    assert.equal(conflict.json.error.details[0].requested, 2);
    assert.equal(conflict.json.error.details[0].available, 1);
    assert.equal(conflict.json.error.details[0].message, 'Only 1 copy is available. You requested 2.');
    assert.equal(conflict.json.orderId, undefined);

    const stillThere = await api(port, 'GET', '/v1/books/bk_1042');
    assert.equal(stillThere.json.stock, 1);
  });

  it('treats a repeated order as a new purchase unless an idempotency key is reused', async () => {
    const key = 'order-try-1';
    const first = await api(port, 'POST', '/v1/orders', {
      token: meera,
      headers: { 'Idempotency-Key': key },
      body: { bookId: 'bk_1042', quantity: 1, shippingAddress: address }
    });
    assert.equal(first.status, 201);
    assert.equal(first.json.items[0].quantity, 1);
    assert.equal(first.json.totalAmount, 499);

    const replay = await api(port, 'POST', '/v1/orders', {
      token: meera,
      headers: { 'Idempotency-Key': key },
      body: { bookId: 'bk_1042', quantity: 1, shippingAddress: address }
    });
    assert.equal(replay.status, 201);
    assert.equal(replay.headers.get('idempotency-replay'), 'true');
    assert.equal(replay.json.orderId, first.json.orderId);

    const book = await api(port, 'GET', '/v1/books/bk_1042');
    assert.equal(book.json.stock, 0);

    const mismatched = await api(port, 'POST', '/v1/orders', {
      token: meera,
      headers: { 'Idempotency-Key': key },
      body: { bookId: 'bk_1042', quantity: 2, shippingAddress: address }
    });
    assert.equal(mismatched.status, 409);
    assertError(mismatched.json, 409, 'IDEMPOTENCY_KEY_REUSED');

    const soldOut = await api(port, 'POST', '/v1/orders', {
      token: meera,
      body: { bookId: 'bk_1042', quantity: 1, shippingAddress: address }
    });
    assert.equal(soldOut.status, 409);
    assert.equal(soldOut.json.error.details[0].available, 0);
    assert.equal(soldOut.json.error.details[0].message, 'This book is out of stock. You requested 1.');
  });

  it('removes a cart line when the book is deleted', async () => {
    const added = await api(port, 'POST', '/v1/cart/items', {
      token: meera,
      body: { bookId: 'bk_1108', quantity: 1 }
    });
    assert.equal(added.status, 201);

    const removed = await api(port, 'DELETE', '/v1/books/bk_1108', { token: staff });
    assert.equal(removed.status, 204);

    const gone = await api(port, 'GET', '/v1/books/bk_1108');
    assert.equal(gone.status, 404);

    const cart = await api(port, 'GET', '/v1/cart', { token: meera });
    assert.ok(cart.json.items.every((item) => item.bookId !== 'bk_1108'));

    const again = await api(port, 'DELETE', '/v1/books/bk_1108', { token: staff });
    assert.equal(again.status, 404);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${meera}`
      },
      body: '{oops'
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assertError(json, 400, 'INVALID_JSON');
  });
});
