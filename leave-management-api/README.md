# Leave Management API

HR leave requests, exposed as a small Spring Boot service. Employees can file a leave, look it up, change it, or withdraw it. Nothing is stored in a database. Requests live in a `ConcurrentHashMap` for as long as the process is running.

The call goes Controller, then Service, then Repository. The controller only deals with HTTP. The service checks the length of the leave and whether it clashes with another pending or approved request for the same employee. The repository reads and writes the map.

## Requirements

- Java 21
- Maven 3.9 or newer

## Build and run

From this folder:

```powershell
mvn spring-boot:run
```

The `dev` profile is on by default. On startup the log includes a line like:

```text
dev profile is active. A leave request can be at most 30 days.
```

The API listens on `http://localhost:8080`. Stop it with Ctrl+C.

`src/main/resources/application.yml` sets the application name and turns the `dev` profile on. `application-dev.yml` raises the leave cap from 15 days to 30 and turns on debug logging for this package.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/leaves` | All leave requests |
| GET | `/leaves/{id}` | One leave request |
| POST | `/leaves` | Create a leave request. Returns 201 and a `Location` header. |
| PUT | `/leaves/{id}` | Replace the fields of an existing request |
| DELETE | `/leaves/{id}` | Remove a request. Returns 204. |

A leave has `id`, `employeeId`, `leaveType`, `startDate`, `endDate`, `reason`, and `status`.

`leaveType` is `SICK`, `CASUAL`, `EARNED`, or `UNPAID`. `status` is `PENDING`, `APPROVED`, `REJECTED`, or `CANCELLED`. If you leave `status` out of a create call, it is stored as `PENDING`.

Dates are `yyyy-MM-dd`. `endDate` has to be on or after `startDate`. The `dev` profile rejects anything longer than 30 days. A new request is also rejected with 409 when that employee already has a pending or approved leave on any of those days. A rejected or cancelled request does not block the dates.

### Create

```powershell
curl.exe -s -D - -X POST http://localhost:8080/leaves `
  -H "Content-Type: application/json" `
  -d "{\"employeeId\":\"E1024\",\"leaveType\":\"SICK\",\"startDate\":\"2026-11-02\",\"endDate\":\"2026-11-04\",\"reason\":\"Fever\"}"
```

```json
{
  "id": 1,
  "employeeId": "E1024",
  "leaveType": "SICK",
  "startDate": "2026-11-02",
  "endDate": "2026-11-04",
  "reason": "Fever",
  "status": "PENDING"
}
```

### Validation error

A missing field, a bad enum, or an end date before the start date returns 400. The body names the field:

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "The request body has invalid fields.",
  "path": "/leaves",
  "fieldErrors": [
    {
      "field": "employeeId",
      "message": "employeeId is required"
    }
  ]
}
```

An unknown id returns 404. An overlapping leave returns 409.

## Tests

```powershell
mvn test
```

`LeaveServiceImplTest` covers the service rules with the in-memory repository. `LeaveControllerTest` calls the controller through MockMvc, including the validation and not-found responses. The last run was 22 tests, 0 failures.

## Screenshots

Startup, with the dev profile and Tomcat on port 8080:

![Application startup](screenshots/startup.png)

Create, fetch, update, validation error, overlap, delete, and the 404 that follows:

![REST API calls](screenshots/api-calls.png)

`mvn test`:

![Test suite](screenshots/tests.png)

A longer walk-through of what was built, why each layer exists, and how a create request moves is in [LEARNING.md](LEARNING.md).

## Layout

```text
controller        HTTP mapping and status codes
service           leave rules
repository        ConcurrentHashMap store
model             LeaveRequest and the two enums
dto               request, response, and error bodies
exception         not-found, rejected requests, and @RestControllerAdvice
configuration     leave.max-days and the dev profile log
```
