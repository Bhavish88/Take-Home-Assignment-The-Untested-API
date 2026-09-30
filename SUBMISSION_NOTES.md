# Submission Notes & Design Decisions

This document summarizes the architectural design decisions, tradeoffs, reflections, and production considerations for the Task Manager API take-home assignment.

---

## 1. Feature Implementation: `PATCH /tasks/:id/assign`

### Endpoint Specification
- **Method:** `PATCH`
- **Path:** `/tasks/:id/assign`
- **Request Body:** `{ "assignee": "string" }`
- **Responses:**
  - `200 OK`: Returns the updated task object with the `assignee` property set.
  - `400 Bad Request`: When `assignee` is missing, not a string, empty, or composed solely of whitespace.
  - `404 Not Found`: When `:id` does not match an existing task.
  - `500 Internal Server Error`: For unhandled runtime exceptions.

### Architecture & Layering
In keeping with the project's separation of concerns:
1. **Validation (`src/utils/validators.js`)**:
   - `validateAssignTask(body)` enforces schema integrity before any business logic is executed.
   - Guarantees `body` is an object, `assignee` is provided, is a string, and has non-zero length after trimming.
2. **Business Logic & Persistence (`src/services/taskService.js`)**:
   - `assignTask(id, assignee)` locates the task by ID, trims extraneous whitespace, updates the task state, and returns the modified task.
   - Tasks created via `create()` now initialize with `assignee: null` for schema consistency.
3. **HTTP Routing (`src/routes/tasks.js`)**:
   - Handles route parameters, invokes validation and service methods, and maps outcomes to standard HTTP status codes (`200`, `400`, `404`).

### Design Decisions & Edge Cases
- **Handling Already-Assigned Tasks (Reassignment):**
  - *Decision:* Tasks can be reassigned to a new user without error.
  - *Rationale:* In standard workflow and project management tools (Jira, Linear, GitHub Issues), reassigning a task to another team member is normal behavior. Throwing an error or requiring unassignment first would introduce unnecessary friction for API consumers.
- **Whitespace Handling:**
  - *Decision:* Rejects whitespace-only strings with a `400 Bad Request` (`'assignee is required and must be a non-empty string'`). Valid names with surrounding padding (e.g., `'  Bhavish  '`) are sanitized using `.trim()` before storage.
- **Task Existence Check:**
  - *Decision:* Returns `404 Not Found` with `{ "error": "Task not found" }`, matching existing endpoints (`PUT /tasks/:id`, `DELETE /tasks/:id`, `PATCH /tasks/:id/complete`).

---

## 2. Test Suite & Coverage Summary

The test suite was built using **Jest** and **Supertest**, achieving over 98% overall test coverage:

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/routes/tasks.js` | 100% | 100% | 100% | 100% |
| `src/services/taskService.js` | 100% | 100% | 100% | 100% |
| `src/utils/validators.js` | 100% | 100% | 100% | 100% |
| `src/app.js` | 84.61% | 75% | 50% | 84.61%* |
| **All files** | **98.77%** | **99.02%** | **96.66%** | **98.65%** |

*\*Note: The only uncovered lines in `src/app.js` are lines 17-18 (`app.listen`), which only execute when running the file directly with `node src/app.js` rather than being imported by the test harness.*

- **Total Test Suites:** 3 passed, 3 total
- **Total Tests:** 86 passed, 86 total

---

## 3. Reflections & Answers to Assignment Prompts

### What surprised you in the codebase?
1. **Resetting Priority on Completion:** In `taskService.completeTask`, line 69 explicitly hardcoded `priority: 'medium'`. Overwriting user priority upon completion was unexpected and would cause data loss in production.
2. **Substring Matching in Status Filtering:** Using `t.status.includes(status)` in `getByStatus` allowed queries like `?status=do` to return both `todo` and `done` items, which is inconsistent with REST filtering conventions.
3. **Discrepancy Between README and Code:** The `README.md` documented statuses as `pending | in-progress | completed`, whereas the implementation and `ASSIGNMENT.md` enforced `todo | in_progress | done`.

### What tradeoffs did you make?
1. **Preserving In-Memory Architecture vs. Persistence:** Maintained the in-memory array data store as requested rather than introducing a persistent database or ORM, keeping the test execution fast, isolated, and dependency-free.
2. **Reassignment Flexibility vs. Strict Locks:** Chose to allow reassignment by default. In an enterprise system with audit compliance, task reassignment might require permission checks or status transition rules, but for this API layer, standard partial update semantics (`PATCH`) were appropriate.
3. **Defensive Validation vs. Framework Libraries:** Enhanced the existing custom validator functions rather than pulling in external validation libraries (e.g., Joi or Zod) to avoid unnecessary dependencies and preserve the codebase's existing style.

### What would you test next if you had more time?
1. **Concurrent Request Stress Testing:** Test race conditions and asynchronous access under high concurrent load (even though JavaScript is single-threaded, asynchronous I/O and multi-process clustering can introduce concurrency anomalies).
2. **Unassign Endpoint / Nullability:** Test clearing an assignee (e.g. `assignee: null` or `DELETE /tasks/:id/assign`).
3. **Combined Query Parameters:** Thoroughly test combinations of query parameters (e.g., `?status=todo&page=2&limit=5`), and implement multi-filter support where status and pagination work together.
4. **Security & Input Sanitization:** Test boundary edge cases for injection attacks, very large payloads, and non-ASCII/Unicode names.

### What questions would you ask before shipping this to production?
1. **Persistence & Database Strategy:** What database will back this in production (PostgreSQL, MongoDB), and how should indexing be configured for `status`, `dueDate`, and `assignee`?
2. **Authentication & Authorization:** Who is authorized to assign or complete tasks? Do we need role-based access control (RBAC), and should `assignee` refer to a verified User ID from an auth service rather than an arbitrary string?
3. **Audit Trail & Event Logging:** Do we need an audit history or event stream (e.g., Kafka / Webhooks) for status transitions and reassignments (e.g., recording `assignedAt`, `assignedBy`, `previousAssignee`)?
4. **Pagination Contract:** Should the API return pagination metadata in response headers or an envelope (e.g., `{ data: [...], pagination: { total, page, limit, totalPages } }`) to help frontend clients render pagination controls?
