# Complete Take-Home Assignment Walkthrough & Summary

This document provides a complete, self-contained record of all work executed on the **"Take-Home Assignment — The Untested API"** for the Full Stack Developer Intern position. You can share this document directly with ChatGPT, reviewers, or interviewers.

---

## 1. Executive Summary

- **Repository:** `Take-Home-Assignment-The-Untested-API`
- **Stack:** Node.js, Express 4.18, Jest 29.7, Supertest 6.3
- **Test Results:** 86 tests written across 3 test suites — **100% passing**.
- **Test Coverage:** **98.77% statements, 99.02% branches, 96.66% functions, 98.65% lines** (100% across routes, services, and validators).
- **Bugs Identified:** 5 real bugs identified and documented with root causes and reproduction steps.
- **Bugs Fixed:** Fixed the critical pagination offset bug, priority reset bug, status filter substring matching bug, and null/non-object validator crash bug.
- **Feature Implemented:** `PATCH /tasks/:id/assign` with comprehensive validation, whitespace sanitization, 404 handling, and reassignment logic.
- **Documentation Delivered:** Detailed bug report (`BUG_REPORT.md`), submission notes & reflection (`SUBMISSION_NOTES.md`), and updated `README.md`.

---

## 2. All Files Created or Modified

| File | Type | Description |
|---|---|---|
| `task-api/src/utils/validators.js` | Modified | Added `validateAssignTask`, guarded against null/non-object bodies. |
| `task-api/src/services/taskService.js` | Modified | Fixed pagination offset, exact status matching, preserved priority on complete, added `assignTask`, set `assignee: null` on creation. |
| `task-api/src/routes/tasks.js` | Modified | Added `PATCH /:id/assign` route handler with validation and status mappings. |
| `task-api/tests/unit/validators.test.js` | Created | 25 unit tests for all input validators (create, update, assign). |
| `task-api/tests/unit/taskService.test.js` | Created | 28 unit tests for all service methods and bug regressions. |
| `task-api/tests/integration/tasks.test.js` | Created | 33 integration tests using Supertest covering all HTTP endpoints. |
| `BUG_REPORT.md` | Created | Formal bug report for 5 identified bugs with root causes and reproduction. |
| `SUBMISSION_NOTES.md` | Created | Architectural design decisions, reflections, tradeoffs, and future considerations. |
| `README.md` | Modified | Corrected status enum values in docs and documented new assign endpoint. |

---

## 3. Real Bugs Identified & Detailed Analysis

### BUG-01: Off-by-one offset in pagination calculation (CRITICAL)
- **Location:** `task-api/src/services/taskService.js`, lines 11–14
- **What the code did:**
  ```javascript
  const getPaginated = (page, limit) => {
    const offset = page * limit;
    return tasks.slice(offset, offset + limit);
  };
  ```
- **Why it was broken:** The route treats `page` as 1-indexed (`parseInt(page) || 1`). For `page = 1` and `limit = 10`, `offset` calculated to `10`. The service returned `tasks.slice(10, 20)`. The first 10 items (indexes 0 to 9) were completely skipped and could never be retrieved via page 1.
- **The Fix:**
  ```javascript
  const getPaginated = (page, limit) => {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;
    return tasks.slice(offset, offset + limitNum);
  };
  ```

### BUG-02: Priority mutated to `'medium'` upon task completion (DATA LOSS)
- **Location:** `task-api/src/services/taskService.js`, lines 63–77
- **What the code did:**
  ```javascript
  const updated = {
    ...task,
    priority: 'medium',
    status: 'done',
    completedAt: new Date().toISOString(),
  };
  ```
- **Why it was broken:** When completing a high-priority or low-priority task, its priority was silently and unconditionally overwritten to `'medium'`.
- **The Fix:** Removed `priority: 'medium'` from `updated`, preserving the existing `...task` priority.

### BUG-03: Substring matching in status filtering (INCORRECT FILTERING)
- **Location:** `task-api/src/services/taskService.js`, line 9
- **What the code did:**
  ```javascript
  const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
  ```
- **Why it was broken:** Because `'do'` is a substring of both `'todo'` and `'done'`, querying `GET /tasks?status=do` returned both `todo` and `done` items.
- **The Fix:** Changed to exact match: `tasks.filter((t) => t.status === status);`.

### BUG-04: Unhandled `TypeError` on null / non-object bodies (SERVER CRASH / 500)
- **Location:** `task-api/src/utils/validators.js`, lines 4–34
- **What the code did:** Accessed `body.title` directly without type validation.
- **Why it was broken:** If `body` is `null` or not an object, accessing `body.title` throws `TypeError: Cannot read properties of undefined (reading 'title')`, causing an unhandled 500 Internal Server Error instead of a 400 Bad Request.
- **The Fix:** Added `if (!body || typeof body !== 'object') { return 'request body must be an object'; }`.

### BUG-05: Documentation discrepancy on valid task statuses
- **Location:** `README.md` vs `ASSIGNMENT.md` / `validators.js`
- **What the docs said:** `status: "pending | in-progress | completed"`.
- **What the code and assignment enforced:** `status: "todo | in_progress | done"`.
- **The Fix:** Updated `README.md` to reflect the actual valid schema `todo | in_progress | done`.

---

## 4. New Feature Implementation: `PATCH /tasks/:id/assign`

### Route Handler (`task-api/src/routes/tasks.js`):
```javascript
router.patch('/:id/assign', (req, res) => {
  const error = validateAssignTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.assignTask(req.params.id, req.body.assignee);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});
```

### Validator (`task-api/src/utils/validators.js`):
```javascript
const validateAssignTask = (body) => {
  if (!body || typeof body !== 'object') {
    return 'request body must be an object';
  }
  if (body.assignee === undefined || typeof body.assignee !== 'string' || body.assignee.trim() === '') {
    return 'assignee is required and must be a non-empty string';
  }
  return null;
};
```

### Service Method (`task-api/src/services/taskService.js`):
```javascript
const assignTask = (id, assignee) => {
  const task = findById(id);
  if (!task) return null;

  const updated = {
    ...task,
    assignee: assignee.trim(),
  };

  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = updated;
  return updated;
};
```

### Initial Task Shape on `create()`:
```javascript
const create = ({ title, description = '', status = 'todo', priority = 'medium', dueDate = null, assignee = null }) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    assignee,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};
```

---

## 5. Architectural & Design Decisions

1. **Reassignment Behavior:**
   - Tasks that are already assigned can be reassigned to a new user without throwing an error.
   - *Rationale:* In standard workflow tracking systems (e.g. Jira, GitHub Issues), reassigning a task to another team member is normal behavior.
2. **Whitespace Handling:**
   - Rejects empty strings and whitespace-only strings with `400 Bad Request`.
   - Valid names with padding (e.g., `'   Bhavish   '`) are trimmed to `'Bhavish'` before saving.
3. **Layer Separation:**
   - Followed the project's existing structure: router handles HTTP status mappings, validator checks payload schema, and service manages in-memory data mutation.
4. **Isolated Testing:**
   - Used `taskService._reset()` in `beforeEach` hooks across all test suites, ensuring total test isolation with zero state pollution.

---

## 6. Comprehensive Test Suite Breakdown (86 Tests Total)

### Unit Tests: Validators (`task-api/tests/unit/validators.test.js` — 25 tests)
- Constants check for valid statuses and priorities.
- `validateCreateTask`: minimum payload, full payload, null/undefined/non-object bodies, missing title, non-string title, empty title, whitespace title, invalid/valid status enums, invalid/valid priority enums, invalid/valid ISO due dates.
- `validateUpdateTask`: empty body (valid partial update), valid updates, null/undefined body, empty/whitespace title, invalid status/priority/date.
- `validateAssignTask`: valid assignee, null/undefined body, missing assignee, non-string assignee (number, boolean, null, object), empty string, whitespace-only string.

### Unit Tests: Task Service (`task-api/tests/unit/taskService.test.js` — 28 tests)
- `create`: default values (`status: 'todo'`, `priority: 'medium'`, `assignee: null`, `dueDate: null`, valid ISO `createdAt`), custom fields.
- `getAll`: empty array, populated list, returns shallow copy.
- `findById`: existing task, non-existent UUID.
- `getByStatus`: exact match filtering, regression test for substring match exclusion (`'do'` vs `'todo'/'done'`).
- `getPaginated`: regression test for page 1 starting at index 0, page 2 items, page out of bounds, invalid/negative page and limit inputs.
- `getStats`: accurate status breakdown, overdue logic (past due + not done), completed past-due tasks excluded from overdue, unknown status handling.
- `update`: field updates, non-existent task returns null.
- `remove`: deletion returns true, non-existent task returns false.
- `completeTask`: marks done, sets `completedAt`, regression test for priority preservation, non-existent task returns null.
- `assignTask`: assigns user, trims whitespace, reassigns existing assignee, non-existent task returns null.
- `_reset`: completely wipes task array.

### Integration Tests: API Routes (`task-api/tests/integration/tasks.test.js` — 33 tests)
- `GET /tasks`: empty list, all tasks, filtering by status, pagination page 1 vs page 2, default pagination fallbacks.
- `GET /tasks/stats`: accurate counts, overdue computation.
- `POST /tasks`: 201 creation with defaults, 201 creation with full fields, 400 missing title, 400 empty/whitespace title, 400 invalid status, 400 invalid priority, 400 invalid dueDate.
- `PUT /tasks/:id`: 200 update, 404 not found, 400 invalid title, 400 invalid status, 400 invalid priority, 400 invalid dueDate.
- `DELETE /tasks/:id`: 204 no content, verified deletion on subsequent GET, 404 not found.
- `PATCH /tasks/:id/complete`: 200 marked done, sets `completedAt`, preserves priority, 404 not found.
- `PATCH /tasks/:id/assign`: 200 assigned, trimmed assignee, 200 reassignment, 404 not found, 400 missing assignee, 400 empty assignee, 400 whitespace assignee, 400 non-string assignee.
- `Error Handling Middleware`: 500 error response on unhandled runtime exceptions.

---

## 7. Final Test & Coverage Results

```text
> task-api@1.0.0 coverage
> jest --coverage

PASS tests/unit/validators.test.js
PASS tests/unit/taskService.test.js
PASS tests/integration/tasks.test.js
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   98.77 |    99.02 |   96.66 |   98.65 |                   
 src             |   84.61 |       75 |      50 |   84.61 |                   
  app.js         |   84.61 |       75 |      50 |   84.61 | 17-18             
 src/routes      |     100 |      100 |     100 |     100 |                   
  tasks.js       |     100 |      100 |     100 |     100 |                   
 src/services    |     100 |      100 |     100 |     100 |                   
  taskService.js |     100 |      100 |     100 |     100 |                   
 src/utils       |     100 |      100 |     100 |     100 |                   
  validators.js  |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------

Test Suites: 3 passed, 3 total
Tests:       86 passed, 86 total
Snapshots:   0 total
Time:        2.543 s
Ran all test suites.
```
*(The only uncovered lines in `src/app.js` are lines 17–18, which only execute when running `node src/app.js` directly).*

---

## 8. Questions & Answers for the Interview

### What surprised you in the codebase?
- The fact that `completeTask` silently reset the task's priority to `'medium'`, which would cause data loss in production.
- Substring matching in `getByStatus`, meaning `?status=do` returned both `todo` and `done`.
- The pagination calculation bug where page 1 skipped the first 10 items.

### What tradeoffs did you make?
- Maintained the simple in-memory store rather than introducing an external database, keeping tests fast, isolated, and true to the brief.
- Allowed task reassignment without requiring an explicit unassign call first.
- Enhanced native JavaScript validation rather than adding heavy schema validation packages.

### What would you test next?
- Concurrency and race conditions under heavy asynchronous load.
- Combined query parameters (filtering by status and paginating simultaneously).
- Unassigning a task (e.g. setting `assignee: null`).
- Security penetration tests (large payload limits, injection strings).

### What questions would you ask before shipping to production?
- Which persistent database (PostgreSQL, MongoDB) should replace the in-memory array?
- What authentication/authorization system should govern who can create, complete, or assign tasks?
- Should `assignee` be a validated User ID rather than an arbitrary string?
- Should pagination return envelope metadata (`totalCount`, `totalPages`, `hasNextPage`)?
