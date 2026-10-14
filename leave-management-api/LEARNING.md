# What, why, and what to learn

This project is a small HR leave API. An employee can file a leave, look it up, change it, or withdraw it. The assignment is about showing how a Spring Boot request moves through layers.

## What was built

The app is a Maven Spring Boot project. It exposes five endpoints:

| Method | Path | Result |
| --- | --- | --- |
| GET | `/leaves` | Every leave request |
| GET | `/leaves/{id}` | One leave request |
| POST | `/leaves` | Creates one. Returns `201` and a `Location` header |
| PUT | `/leaves/{id}` | Updates one |
| DELETE | `/leaves/{id}` | Removes one. Returns `204` |

Each saved leave has `id`, `employeeId`, `leaveType`, `startDate`, `endDate`, `reason`, and `status`.

Leave types are `SICK`, `CASUAL`, `EARNED`, and `UNPAID`. Status values are `PENDING`, `APPROVED`, `REJECTED`, and `CANCELLED`. If a create request leaves out `status`, the service stores `PENDING`.

There is no database. `InMemoryLeaveRepository` keeps the rows in a `ConcurrentHashMap` and gives each new row the next number from an `AtomicLong`. When the process stops, the data is gone.

## Why the code is split this way

A request does not go from the URL straight into the map. It passes through one job at a time.

**Controller.** `LeaveController` reads the HTTP method and path, takes the JSON body, and chooses the status code. It does not decide whether two leaves overlap.

**Service.** `LeaveServiceImpl` holds the rules. It checks the length of the leave, checks for a clash with another pending or approved leave for the same employee, and sets `PENDING` when status is missing. The controller calls this through the `LeaveService` interface.

**Repository.** `LeaveRepository` is the storage contract. `InMemoryLeaveRepository` is the only class that touches the map. If a database were added later, the service would stay the same and only this class would change.

**Model.** `LeaveRequest` is the object that is stored. `LeaveType` and `LeaveStatus` are enums, so a value such as `"VACATION"` cannot be saved as a leave type.

**DTO.** The client does not send the stored object. `LeaveRequestDto` is the incoming JSON. `LeaveResponseDto` is the outgoing JSON. `ErrorResponse` is the error JSON. The client cannot set `id` on create. The server assigns the id.

**Exception.** When a rule fails, the service throws `LeaveNotFoundException` or `InvalidLeaveRequestException`. It does not build an HTTP response. `GlobalExceptionHandler`, marked with `@RestControllerAdvice`, turns those exceptions into status codes and JSON.

**Configuration.** `LeaveProperties` reads `leave.max-days`. `application.yml` sets the app name, turns on the `dev` profile, and writes dates as `2026-11-02`. `application-dev.yml` changes the cap from 15 days to 30 and turns on debug logs. `DevProfileLogger` prints that cap when the app starts, so the active profile is visible in the startup log.

## Why these choices

**Constructor injection.** `LeaveServiceImpl` receives `LeaveRepository` and `LeaveProperties` in its constructor. Spring creates those objects and passes them in. Tests can pass a real in-memory repository and a `LeaveProperties` with `maxDays` set to 10, without starting the whole application.

**Bean validation.** `LeaveRequestDto` uses `@NotBlank`, `@NotNull`, `@Size`, and a custom `@ValidLeaveDates` check. `@Valid` on the controller method runs those checks before the service is called. A missing `employeeId`, or an `endDate` before `startDate`, never reaches the map. The handler returns `400` and names the field:

```json
{
  "status": 400,
  "message": "The request body has invalid fields.",
  "fieldErrors": [
    { "field": "employeeId", "message": "employeeId is required" }
  ]
}
```

**Rules stay in the service.** Validation checks the shape of the JSON. The service checks the company rules. A leave cannot be longer than `leave.max-days`. Both the start day and the end day count. A new leave is rejected with `409` when that employee already has a `PENDING` or `APPROVED` leave on any of those days. A `REJECTED` or `CANCELLED` leave does not block the dates. An update ignores the row being edited, so changing a leave does not clash with itself.

**One error shape.** A missing id is `404`. Bad JSON or a wrong type is `400`. An overlap is `409`. An unexpected failure is `500`. Every one of those responses uses `ErrorResponse`, so a client always reads `status`, `error`, `message`, and `path`.

**Two kinds of tests.** `LeaveServiceImplTest` calls the service directly. It checks ids, the default status, the day limit, overlap, and delete. `LeaveControllerTest` uses MockMvc. The service is replaced with a test double, and the test checks HTTP: `201` with `Location`, `400` with the field name, `404`, and `204`. The suite is 12 service tests and 10 controller tests.

## How a create request moves

1. `POST /leaves` hits `LeaveController`.
2. Spring turns the JSON into `LeaveRequestDto` and runs validation.
3. If validation fails, `GlobalExceptionHandler` returns `400` and the service is never called.
4. If validation passes, `LeaveServiceImpl` checks the length and the overlap.
5. The repository stores a `LeaveRequest` in the map and assigns the id.
6. The controller returns `201`, the `Location` header, and `LeaveResponseDto`.

## What to take from this

HTTP stays in the controller. Rules stay in the service. Storage stays in the repository. Bad input is rejected by validation. A broken rule becomes an exception, and one handler turns that exception into a stable JSON error. A setting such as the 30-day cap stays in `application-dev.yml`, so the rule can change without editing the Java that enforces it.
