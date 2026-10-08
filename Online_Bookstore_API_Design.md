# Online Bookstore System — RESTful API Backend Design

## Task 1: Backend Architecture and Request Lifecycle

### 1. Journey of an "Add to Cart" request

Suppose the bookstore site is served from `https://www.booknook.example` and the API lives at `https://api.booknook.example`. The shopper is on a book page and clicks **Add to Cart** for two copies of a book whose id is `bk_1042`.

The click does not talk to the database. It starts a normal web request, and that request has to be named, secured, routed, checked against business rules, saved, and answered. The steps below are that round trip.

**1. The browser builds the request**

The page's JavaScript handles the click. It does not send the price the user sees on the screen as the price to charge. The client only says which book and how many copies:

- Method: `POST`
- URL: `https://api.booknook.example/v1/cart/items`
- Header `Content-Type: application/json`
- Header `Authorization: Bearer <access token>` (or the session cookie, if the site uses cookie login)
- Body: `{ "bookId": "bk_1042", "quantity": 2 }`

`POST` is the right verb because adding a line can create a new cart item. If that book is already in the cart, the server may instead increase the quantity. Either way the client is asking the server to change state.

**2. DNS lookup turns the hostname into an IP address**

The browser cannot open a connection to the name `api.booknook.example`. It needs a numeric address. It asks a DNS resolver for that name.

The resolver usually checks its cache first. If the record is still fresh, it returns the answer immediately. If not, it walks the DNS hierarchy: root servers, then the `.example` TLD servers, then the authoritative server for `booknook.example`. That server returns an `A` record (IPv4, for example `203.0.113.24`) or an `AAAA` record (IPv6). The browser caches the answer for the TTL on the record so the next click does not repeat the lookup.

DNS itself normally uses UDP port 53, and falls back to TCP port 53 when the response is too large. After this step the browser knows the IP. It still does not know anything about carts or stock. DNS only maps a name to an address.

**3. TCP connection and HTTPS on port 443**

The browser opens a TCP connection to `203.0.113.24` on port **443**, the standard port for HTTPS. Port **80** is the standard port for plain HTTP. A bookstore that handles logins, carts, and payments should not use plain HTTP for this call, because the token and the cart body would travel in the clear.

HTTPS is HTTP carried inside TLS. Before any cart data is sent, the client and server do a TLS handshake:

- The server presents its certificate.
- The browser checks that the certificate is valid and that the name on it matches `api.booknook.example`.
- Both sides agree on session keys.

After the handshake, the HTTP request is encrypted on the wire. A load balancer or reverse proxy in front of the API often terminates TLS, then forwards the request over the private network to an application instance.

**4. The HTTP request arrives at the server**

The web server (Nginx, a cloud load balancer, or the Node/Java process itself) accepts the connection and reads the HTTP request line, headers, and body. It uses the method and the path to pick a route. `POST /v1/cart/items` is handed to the cart controller. A request for a static image would never reach that code.

At this point the server has bytes. It has not yet decided whether the shopper is allowed to add the book.

**5. Application / business logic layer**

The controller parses the JSON and calls the cart service. This layer is where the bookstore's rules live. It is described in detail in the next section. In short, it checks the token, checks that the book exists and can be sold, checks stock and cart limits, and decides the price from the catalog rather than from the browser.

**6. Database**

The service talks to the database through a repository, not by scattering SQL through the controller. A typical add-to-cart needs two kinds of access:

- Reads: the user or session, the book row (price, status, stock), and the current cart line if one already exists.
- Writes: insert a cart line, or update the quantity on the existing line.

Those reads and writes belong in one transaction. If the stock check and the cart insert are separate and not locked, two shoppers can both pass the check and oversell the last copy. The usual pattern is to lock the book row (or decrement a reserved count) and write the cart line in the same transaction, then commit. If anything fails, the transaction rolls back and the cart is unchanged.

**7. The response travels back**

The service returns a result object. The controller turns it into JSON and an HTTP status:

- `201 Created` if a new cart line was inserted, with a `Location` header such as `/v1/cart/items/ci_551`
- `200 OK` if the same book was already in the cart and only the quantity changed

The server writes the status line, headers (`Content-Type: application/json`), and body onto the same TLS connection. The browser decrypts it, the frontend reads the JSON, and the cart badge updates. If the status is `401`, `404`, or `409`, the page shows the error instead of pretending the item was added.

```text
Browser
  |  click "Add to Cart"
  |  build POST /v1/cart/items
  v
DNS resolver  --->  IP address of api.booknook.example
  |
  v
TCP + TLS on port 443
  |
  v
Web server / reverse proxy
  |  route by method + path
  v
Controller
  |
  v
Business logic  (auth, stock, price, cart rules)
  |
  v
Database transaction  (read book + cart, write cart line)
  |
  v
JSON response + status code
  |
  v
Browser updates the cart UI
```

### 2. What the application / business logic layer does on this click

The controller should stay thin. The service underneath it owns the rules. For add-to-cart those responsibilities are:

**Authentication.** Read the bearer token or session cookie. Reject a missing or expired token with `401 Unauthorized`. The cart is per shopper, so an anonymous call is not accepted unless the product deliberately supports a guest cart tied to a signed cart id.

**Authorization.** Confirm that the token's user is the owner of the cart being changed. A shopper must not be able to push items into someone else's cart by guessing an id. Failure here is `403 Forbidden`.

**Input validation.** `bookId` must be present. `quantity` must be an integer greater than zero, and not above a hard per-line cap (for example 10). A quantity of `-1` or `"two"` is `400 Bad Request` and never reaches the database as a write.

**The book must be sellable.** Load the book. If the id does not exist, return `404 Not Found`. If the book is discontinued or not yet published, reject the add even if a stale product page is still open.

**Inventory.** Compare the requested quantity with stock on hand, including copies already sitting in this cart. If the shopper asks for 2 and only 1 is left, return `409 Conflict` and do not change the cart. The check has to happen on the server. The number rendered on the product page may already be out of date.

**Price is a server concern.** The line is priced from the `books` row at the moment it is added. The client does not get to submit `unitPrice`. That stops someone from editing the request in the browser devtools and checking out at one rupee.

**Cart rules.** If the book is already a line in this cart, increase that line instead of inserting a second row for the same book. Re-check the per-line cap after the increase. Some stores also cap the number of distinct lines or the cart total. Those rules sit here, not in the frontend.

**Persistence.** Ask the repository to commit the cart change inside the transaction described above. The service does not assemble SQL. It also does not choose HTTP status codes for the database driver. It returns a clear result ("created", "updated", "out of stock") and the controller maps that to a status code.

**Response shape.** Return the stored line: cart item id, book id, quantity, the server's unit price, and the line total. Leave payment, tax calculation for checkout, and shipping labels to later steps. Add-to-cart is not place-order.

Logging and a request id belong in this layer too, so a failed add can be traced without logging the raw token.

---

## Task 2: RESTful Endpoint Design

Resource names are plural nouns, lowercase, and every path is under `/v1`. Book inventory and orders are separate resources. A price change is a partial update of a book, so it uses `PATCH` rather than a full `PUT` replacement. Orders belonging to one user are nested under that user, because the requirement is "orders of this user", not "every order in the system filtered by luck".

`Safe` means the call does not change server state. `Idempotent` means sending the same request once or several times leaves the server in the same state.

| Requirement / Operation | HTTP Method | Endpoint (URL Path) | Safe? | Idempotent? | Brief Description |
| --- | --- | --- | --- | --- | --- |
| Fetch list of all books | GET | `/v1/books` | Yes | Yes | Returns the book collection. Query parameters may filter by title, author, or category, and may paginate. Nothing is written. |
| Fetch details of a specific book by ID | GET | `/v1/books/{bookId}` | Yes | Yes | Returns one book. Repeating the call returns the same representation and does not change inventory. Unknown ids respond with 404. |
| Add a new book to the inventory | POST | `/v1/books` | No | No | Creates a book record from the JSON body. A second identical call can create a second row, so the call is neither safe nor idempotent. |
| Update price of an existing book | PATCH | `/v1/books/{bookId}` | No | Yes | Replaces the stored price with the price in the body. Sending the same price again leaves the row unchanged, so the operation is idempotent, but it is not safe because the first call writes. |
| Delete a book record from inventory | DELETE | `/v1/books/{bookId}` | No | Yes | Removes that book. A repeated delete does not remove anything further. The first call changes state, so it is not safe. |
| Place a new book order | POST | `/v1/orders` | No | No | Creates an order for the authenticated shopper. Each call is a new purchase, so repeating it must not be treated as the same order. |
| Retrieve all orders belonging to a specific user | GET | `/v1/users/{userId}/orders` | Yes | Yes | Returns that user's orders only. Read-only, so it is safe and idempotent. A caller who is not that user, and is not staff, receives 403. |

### Notes on the choices

**GET list and GET one book.** Both are classic reads. Filters and pagination stay in the query string (`/v1/books?author=lehane&page=2`) so the resource path itself stays stable.

**POST /v1/books.** Creation is not idempotent unless the client sends an idempotency key and the server stores it. I am not assuming that mechanism for catalog inserts. Staff who retry a timed-out create should look up the book by ISBN before posting again. A unique constraint on ISBN is a data rule, not a reason to mark POST as idempotent.

**PATCH for price.** The operation only changes price. `PUT /v1/books/{bookId}` would mean "replace the whole book" and would force the client to resend title, author, ISBN, and stock just to change one field. A body of `{ "price": 499.00 }` on PATCH is enough. Setting a field to an absolute value is idempotent: five identical patches still leave the price at 499.00. An endpoint that *added* 10 to the price would not be idempotent, and I am not designing it that way.

**DELETE.** After the first successful delete the book is gone. Further deletes of the same id do not delete a second book. Responding `404` on the later call is fine. The resource state stays "absent", which is why DELETE is idempotent.

**POST /v1/orders.** Placing an order charges stock and creates a commercial record. Two identical posts are two orders. If the client needs retry-without-duplicates, it can send an `Idempotency-Key` header and the server can store the first response against that key. That is an extra safeguard. The method itself stays non-idempotent.

**GET /v1/users/{userId}/orders.** Nesting reads more clearly than `GET /v1/orders?userId=`. The collection is "this user's orders". Staff can still have a separate admin route later. It is not required by the table.

---

## Task 3: Data Exchange and JSON Payloads

Operation: **Place a new book order**, `POST /v1/orders`.

The shopper is already logged in. The access token was issued at login. The order prices the book from the database. The client sends the book, the quantity, and where to ship it. It does not send the price.

### 1. Successful order creation — 201 Created

**Request**

```http
POST /v1/orders HTTP/1.1
Host: api.booknook.example
Content-Type: application/json
Accept: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMjA0OCJ9.signature
```

```json
{
  "bookId": "bk_1042",
  "quantity": 2,
  "shippingAddress": {
    "fullName": "Meera Iyer",
    "line1": "14 Lake View Road",
    "line2": "Flat 3B",
    "city": "Pune",
    "state": "Maharashtra",
    "postalCode": "411001",
    "country": "IN",
    "phone": "+919800011122"
  }
}
```

`Content-Type` tells the server the body is JSON. `Accept` tells it the client wants JSON back. `Authorization` carries the bearer token. Without that header the call is rejected before the body is treated as an order.

**Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /v1/orders/ord_88321
```

```json
{
  "orderId": "ord_88321",
  "userId": "usr_2048",
  "status": "confirmed",
  "items": [
    {
      "bookId": "bk_1042",
      "title": "The Night Circus",
      "quantity": 2,
      "unitPrice": 499.00,
      "lineTotal": 998.00
    }
  ],
  "shippingAddress": {
    "fullName": "Meera Iyer",
    "line1": "14 Lake View Road",
    "line2": "Flat 3B",
    "city": "Pune",
    "state": "Maharashtra",
    "postalCode": "411001",
    "country": "IN",
    "phone": "+919800011122"
  },
  "currency": "INR",
  "totalAmount": 998.00,
  "createdAt": "2026-10-08T13:15:22Z"
}
```

`201` means a new order resource was created. `Location` is the URL of that order. `unitPrice` and `totalAmount` come from the catalog row, not from the request. `status` is `confirmed` only after the stock decrement and the order insert both commit. `createdAt` is UTC.

### 2. Error handling — requested quantity exceeds stock

The same request is sent, but `bk_1042` has only 1 copy left. The business layer refuses the order. It does not create a partial order and it does not decrement stock.

This is a conflict with the current state of the inventory, so the status is **409 Conflict**. It is not a `400`, because the JSON shape is valid: `quantity` really is a positive integer. It is not a `422` caused by a malformed address. The data is well formed and the resource cannot accept it right now.

**Response**

```http
HTTP/1.1 409 Conflict
Content-Type: application/json
```

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

`code` is stable and meant for the client program (`INSUFFICIENT_STOCK` can drive a specific UI state). `message` is a sentence a person can read. `details` points at the field that failed, names the book, and reports both numbers so the page can correct the quantity without another round trip. The HTTP status is repeated inside the body so a log line that only stored the JSON still shows 409.

No `orderId` is returned. Nothing was created.

---

## Assumptions

- The API is HTTPS only. Port 443 in production.
- Shoppers authenticate with a bearer token. Catalog changes (`POST`, `PATCH`, `DELETE` on books) are limited to staff. That authorization is enforced in the business layer even though the table does not add a separate column for it.
- Money is decimal currency in INR, computed on the server.
- One order in this design contains the single book the requirement asks for. The response uses an `items` array so a later multi-book order does not break clients.
- Add to cart (Task 1) and place order (Tasks 2 and 3) are different operations. The cart holds intent. The order is the purchase.

---

## Implementation

The design above is implemented in the `bookstore-api` folder. Express receives the HTTP call, a route file picks the status code, and a service file owns the rules from Task 1: the bearer token, the staff check on catalog writes, the stock check, and the price, which is always read from the `books` table. SQLite stores users, sessions, books, cart lines, and orders. Stock is reduced in the same transaction that inserts the order, so a failed order does not leave a half-written purchase.

The paths match the table in Task 2. `POST /v1/orders` returns the 201 body from Task 3, and a quantity the shelf cannot cover returns 409 with `INSUFFICIENT_STOCK`, the field name, and the requested and available counts. JSON numbers drop trailing zeros, so a price written as 499.00 in this document is `499` on the wire. It is the same amount.

Demo shopper: `meera.iyer@booknook.example` / `meera123`. Demo staff: `arjun.shah@booknook.example` / `staff123`. Book `bk_1042` is The Night Circus at 499 INR. How to start the server is in `bookstore-api/README.md`.
