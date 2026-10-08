# Online Bookstore API

This is the backend that goes with the written design in `Online_Bookstore_API_Design.md` (one folder up).

A request comes in over HTTP, a route picks the handler, the service applies the bookstore rules (who you are, whether the book can be sold, whether the stock covers the quantity, what the price is), and SQLite stores the result. The route then sends the status code and JSON.

## Run it

Node 22 is required. The database is the built-in `node:sqlite` module, so there is nothing extra to compile.

```powershell
cd bookstore-api
npm install
npm start
```

The server listens on `http://localhost:3000`. The database file is created at `data/bookstore.db` the first time you start it.

To check the behaviour described in the assignment:

```powershell
npm test
```

## Demo logins

These accounts are seeded into an empty database. They are for this project only.

| Who | Email | Password | Role |
| --- | --- | --- | --- |
| Meera Iyer | meera.iyer@booknook.example | meera123 | customer |
| Rohit Menon | rohit.menon@booknook.example | rohit123 | customer |
| Arjun Shah | arjun.shah@booknook.example | staff123 | staff |

`bk_1042` is The Night Circus, priced at 499 INR, with 8 copies in stock. `bk_1300` (Old Atlas) is discontinued, so it can be fetched but it cannot be added to a cart or ordered.

## Endpoints

Catalog reads are public. Changing the catalog is staff-only. Cart and orders need a bearer token.

| What | Method and path |
| --- | --- |
| Log in | `POST /v1/auth/login` |
| List books | `GET /v1/books` |
| One book | `GET /v1/books/{bookId}` |
| Add a book | `POST /v1/books` |
| Change a price | `PATCH /v1/books/{bookId}` |
| Delete a book | `DELETE /v1/books/{bookId}` |
| View your cart | `GET /v1/cart` |
| Add to cart | `POST /v1/cart/items` |
| Place an order | `POST /v1/orders` |
| One order | `GET /v1/orders/{orderId}` |
| A user's orders | `GET /v1/users/{userId}/orders` |

`GET /v1/books` accepts `title`, `author`, `category`, `status`, `page`, and `limit`.

Adding the same book to the cart again increases the quantity on the existing line. The first add returns `201`. A later add of the same book returns `200`. The line is capped at 10 copies. The price is always read from the `books` row. If the client sends `unitPrice`, `price`, or `totalAmount`, the API answers `400`.

`POST /v1/orders` is a new purchase every time. Stock is reduced in the same database transaction as the order insert. If you need a safe retry, send an `Idempotency-Key` header. The same key and the same body return the original order. The same key with a different body returns `409`.

A customer can read only their own orders. Staff can read any user's orders.

## Walk-through

Log in (PowerShell):

```powershell
curl.exe -s -X POST http://localhost:3000/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"meera.iyer@booknook.example","password":"meera123"}'
```

Copy the `token` value, then:

```powershell
curl.exe -s -X POST http://localhost:3000/v1/cart/items `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer PASTE_TOKEN" `
  -d '{"bookId":"bk_1042","quantity":2}'
```

Place the order from the design write-up:

```powershell
curl.exe -s -D - -X POST http://localhost:3000/v1/orders `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer PASTE_TOKEN" `
  -d '{"bookId":"bk_1042","quantity":2,"shippingAddress":{"fullName":"Meera Iyer","line1":"14 Lake View Road","line2":"Flat 3B","city":"Pune","state":"Maharashtra","postalCode":"411001","country":"IN","phone":"+919800011122"}}'
```

A successful call is `201 Created` with a `Location` header. `unitPrice` and `totalAmount` come from the catalog (499 and 998 for two copies). JSON numbers do not keep the trailing zeros from the written example, so the body shows `499` and `998`, which are the same values.

To see the stock failure, drop the shelf count to 1 and ask for 2. From a second terminal, with the server stopped, you can edit the row, or just order until the copies run out. The response is `409` and looks like this:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "The order could not be placed because the requested quantity is no longer in stock.",
    "status": 409,
    "details": [
      {
        "field": "quantity",
        "bookId": "bk_1042",
        "message": "Only 1 copy is available. You requested 2.",
        "requested": 2,
        "available": 1
      }
    ]
  }
}
```

No order id is returned in that case, and the stock count is left as it was.

## Layout

```text
src/server.js            starts HTTP and opens the database file
src/app.js               wires the routes
src/routes/              thin handlers, status codes, Location headers
src/services/            auth, inventory, cart limits, order rules
src/db.js                tables and the demo seed
src/middleware/auth.js   bearer token and staff check
```

Money is INR. Order history keeps the title and price from the moment of purchase, so a later price change does not rewrite an old order.
