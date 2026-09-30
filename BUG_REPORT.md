# Bug Report — The Untested API

This document details the bugs and discrepancies identified during code inspection and comprehensive test suite development for the Task Manager API.

---

## Summary of Identified Bugs

| ID | Issue | Location | Severity | Status |
|---|---|---|---|---|
| **BUG-01** | Off-by-one offset in pagination calculation | `src/services/taskService.js:11-14` | High | **Fixed** |
| **BUG-02** | Priority mutated to `'medium'` on task completion | `src/services/taskService.js:63-77` | Medium | **Fixed** |
| **BUG-03** | Substring matching instead of exact match in status filter | `src/services/taskService.js:9` | Medium | **Fixed** |
| **BUG-04** | Unhandled `TypeError` on null / non-object request bodies | `src/utils/validators.js:4-34` | Medium | **Fixed** |
| **BUG-05** | Documentation discrepancy for valid status enum values | `README.md:77` vs `src/utils/validators.js:1` | Low | **Fixed** |

---

## Detailed Bug Reports

### BUG-01: Off-by-one Offset in Pagination Calculation (Primary Bug Fix)

- **Location:** `src/services/taskService.js`, lines 11–14
- **Function:** `getPaginated(page, limit)`
- **Route:** `GET /tasks?page=1&limit=10` (`src/routes/tasks.js:19-24`)

#### Expected Behavior
When requesting page 1 with limit 10 (`/tasks?page=1&limit=10`), the API should return the first 10 items (indexes `0` to `9`). For standard 1-indexed pagination, page $N$ should calculate its slice offset as `(N - 1) * limit`.

#### Actual Behavior
`taskService.getPaginated` calculated the offset as:
```javascript
const offset = page * limit;
```
For `page = 1` and `limit = 10`, `offset` evaluated to `10`, causing the service to slice from index `10` to `20`. The first 10 items (indexes `0` through `9`) were skipped entirely and could never be retrieved via page 1.

#### How It Was Discovered
Discovered through unit testing `taskService.getPaginated(1, 10)` and integration testing `GET /tasks?page=1&limit=2` after populating tasks. The test asserted that `Task 1` should be the first item returned on page 1, but received `Task 11` (or `Item 3`).

#### Root Cause
The formula `page * limit` assumed 0-indexed page input, but `src/routes/tasks.js` defaults and treats `page` as 1-indexed (`parseInt(page) || 1`).

#### The Fix
Updated `taskService.getPaginated` to calculate the 1-indexed offset properly and guard against invalid or negative values:
```javascript
const getPaginated = (page, limit) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const offset = (pageNum - 1) * limitNum;
  return tasks.slice(offset, offset + limitNum);
};
```

#### Regression Tests
- Unit: `tests/unit/taskService.test.js` (`describe('getPaginated')`)
- Integration: `tests/integration/tasks.test.js` (`describe('GET /tasks') -> paginates tasks with page and limit starting from first item on page 1`)

---

### BUG-02: Priority Mutated to `'medium'` on Task Completion

- **Location:** `src/services/taskService.js`, lines 63–77
- **Function:** `completeTask(id)`
- **Route:** `PATCH /tasks/:id/complete` (`src/routes/tasks.js:63-70`)

#### Expected Behavior
Marking a task complete should update its `status` to `'done'` and set `completedAt` to the current ISO timestamp. The task's original `priority` (e.g., `'high'` or `'low'`) must remain unchanged.

#### Actual Behavior
`completeTask` explicitly hardcoded `priority: 'medium'` into the updated object:
```javascript
const updated = {
  ...task,
  priority: 'medium',
  status: 'done',
  completedAt: new Date().toISOString(),
};
```
Completing a task with `'high'` or `'low'` priority silently demoted/promoted it to `'medium'`.

#### How It Was Discovered
Discovered during service unit tests when verifying that completing a task created with `priority: 'high'` preserved its priority.

#### The Fix
Removed the hardcoded `priority: 'medium'` line from `completeTask`, preserving the original task priority through object spread (`...task`).

#### Regression Tests
- Unit: `tests/unit/taskService.test.js` (`describe('completeTask') -> preserves existing priority instead of overriding to medium`)
- Integration: `tests/integration/tasks.test.js` (`describe('PATCH /tasks/:id/complete') -> preserves existing task priority on completion`)

---

### BUG-03: Substring Matching in Status Filtering

- **Location:** `src/services/taskService.js`, line 9
- **Function:** `getByStatus(status)`
- **Route:** `GET /tasks?status=:status` (`src/routes/tasks.js:14-17`)

#### Expected Behavior
Status filtering should perform an exact match against the task status. Filtering by `?status=todo` should return only `todo` tasks.

#### Actual Behavior
`getByStatus` used substring inclusion:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```
Because `'do'` is a substring of both `'todo'` and `'done'`, querying `GET /tasks?status=do` matched both `todo` and `done` tasks. Similarly, querying `?status=pro` matched `in_progress`.

#### How It Was Discovered
Discovered when writing unit tests for `getByStatus` edge cases and partial string inputs.

#### The Fix
Changed substring matching to exact equality comparison:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

#### Regression Tests
- Unit: `tests/unit/taskService.test.js` (`describe('getByStatus') -> does not perform substring matching`)
- Integration: `tests/integration/tasks.test.js` (`describe('GET /tasks') -> filters tasks by status correctly`)

---

### BUG-04: Unhandled `TypeError` on Non-Object or Null Request Bodies

- **Location:** `src/utils/validators.js`, lines 4–34
- **Functions:** `validateCreateTask(body)`, `validateUpdateTask(body)`

#### Expected Behavior
When a client sends an empty payload without a body or a malformed non-object JSON body (e.g. `null`), the validator should safely detect the invalid input and return a validation error string, resulting in an HTTP 400 Bad Request.

#### Actual Behavior
Attempting to read `body.title` directly caused an unhandled `TypeError: Cannot read properties of undefined (reading 'title')`, triggering the 500 Internal Server Error middleware instead of a 400 Bad Request.

#### The Fix
Added defensive type guards at the beginning of each validator function:
```javascript
if (!body || typeof body !== 'object') {
  return 'request body must be an object';
}
```

#### Regression Tests
- Unit: `tests/unit/validators.test.js` (`returns error when body is null or not an object`)

---

### BUG-05: Documentation Discrepancy for Valid Task Status Values

- **Location:** `README.md`, lines 77 and 96 vs `ASSIGNMENT.md`, line 50 and `src/utils/validators.js`, line 1

#### Description
`README.md` listed valid status values as `"pending | in-progress | completed"`, whereas `ASSIGNMENT.md` and the actual codebase (`validators.js`, `taskService.js`) implement `"todo | in_progress | done"`.
Following the sample curl command from `README.md` (`curl "http://localhost:3000/tasks?status=pending"`) failed or returned unexpected results.

#### Resolution
Align documentation with the actual system schema defined in `ASSIGNMENT.md` and `validators.js`: `todo | in_progress | done`.
