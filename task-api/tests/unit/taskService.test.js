const taskService = require('../../src/services/taskService');

describe('taskService Unit Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    it('creates a task with required fields and sensible defaults', () => {
      const task = taskService.create({ title: 'Write unit tests' });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.title).toBe('Write unit tests');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.assignee).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
      expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('creates a task with custom fields', () => {
      const task = taskService.create({
        title: 'Review PR',
        description: 'Check logic and tests',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-10-10T10:00:00.000Z',
        assignee: 'Bhavish',
      });

      expect(task.title).toBe('Review PR');
      expect(task.description).toBe('Check logic and tests');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe('2026-10-10T10:00:00.000Z');
      expect(task.assignee).toBe('Bhavish');
    });
  });

  describe('getAll', () => {
    it('returns an empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    it('returns all created tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const tasks = taskService.getAll();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Task 1');
      expect(tasks[1].title).toBe('Task 2');
    });

    it('returns a shallow copy of tasks array to prevent external direct array mutation', () => {
      taskService.create({ title: 'Task 1' });
      const tasksCopy = taskService.getAll();
      tasksCopy.push({ title: 'Tampered Task' });

      expect(taskService.getAll()).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns task by matching ID', () => {
      const created = taskService.create({ title: 'Search target' });
      const found = taskService.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Search target');
    });

    it('returns undefined if task is not found', () => {
      const found = taskService.findById('non-existent-uuid');
      expect(found).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
    it('returns only tasks matching the exact status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });

      const todos = taskService.getByStatus('todo');
      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Task 1');

      const inProgress = taskService.getByStatus('in_progress');
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('Task 2');

      const done = taskService.getByStatus('done');
      expect(done).toHaveLength(1);
      expect(done[0].title).toBe('Task 3');
    });

    it('does not perform substring matching (Bug Regression Test)', () => {
      taskService.create({ title: 'Todo item', status: 'todo' });
      taskService.create({ title: 'Done item', status: 'done' });

      // 'do' is a substring of both 'todo' and 'done'
      const matched = taskService.getByStatus('do');
      expect(matched).toHaveLength(0);
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }
    });

    it('returns the first page items correctly starting at offset 0 (Bug Regression Test)', () => {
      const page1 = taskService.getPaginated(1, 10);
      expect(page1).toHaveLength(10);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[9].title).toBe('Task 10');
    });

    it('returns the second page correctly', () => {
      const page2 = taskService.getPaginated(2, 10);
      expect(page2).toHaveLength(5);
      expect(page2[0].title).toBe('Task 11');
      expect(page2[4].title).toBe('Task 15');
    });

    it('returns empty array when requested page is beyond total tasks', () => {
      const page3 = taskService.getPaginated(3, 10);
      expect(page3).toEqual([]);
    });

    it('handles edge case of page <= 0 or invalid page/limit by defaulting safely', () => {
      const page = taskService.getPaginated(0, 5);
      expect(page).toHaveLength(5);
      expect(page[0].title).toBe('Task 1');

      const negativePage = taskService.getPaginated(-1, 5);
      expect(negativePage).toHaveLength(5);
      expect(negativePage[0].title).toBe('Task 1');

      // Test non-numeric page and limit to exercise NaN fallback branches
      const nonNumeric = taskService.getPaginated('invalid-page', 'invalid-limit');
      expect(nonNumeric).toHaveLength(10);
      expect(nonNumeric[0].title).toBe('Task 1');
    });
  });

  describe('getStats', () => {
    it('returns correct status counts and overdue count', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day in future

      // 1 overdue todo
      taskService.create({ title: 'T1', status: 'todo', dueDate: pastDate });
      // 1 non-overdue todo
      taskService.create({ title: 'T2', status: 'todo', dueDate: futureDate });
      // 1 overdue in_progress
      taskService.create({ title: 'T3', status: 'in_progress', dueDate: pastDate });
      // 1 done task with past dueDate (should NOT count as overdue)
      taskService.create({ title: 'T4', status: 'done', dueDate: pastDate });
      // 1 done task with no dueDate
      taskService.create({ title: 'T5', status: 'done', dueDate: null });
      // 1 task with unrecognized status
      taskService.create({ title: 'T6', status: 'custom_status', dueDate: null });

      const stats = taskService.getStats();

      expect(stats).toEqual({
        todo: 2,
        in_progress: 1,
        done: 2,
        overdue: 2,
      });
    });


    it('returns all zeros when no tasks exist', () => {
      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });
  });

  describe('update', () => {
    it('updates fields on an existing task', () => {
      const created = taskService.create({ title: 'Initial Title', priority: 'low' });

      const updated = taskService.update(created.id, {
        title: 'New Title',
        priority: 'high',
      });

      expect(updated).toBeDefined();
      expect(updated.title).toBe('New Title');
      expect(updated.priority).toBe('high');
      expect(updated.status).toBe('todo'); // unchanged
    });

    it('returns null when updating a non-existent task', () => {
      const updated = taskService.update('non-existent-id', { title: 'New' });
      expect(updated).toBeNull();
    });
  });

  describe('remove', () => {
    it('removes a task and returns true', () => {
      const created = taskService.create({ title: 'To Delete' });
      const removed = taskService.remove(created.id);

      expect(removed).toBe(true);
      expect(taskService.findById(created.id)).toBeUndefined();
      expect(taskService.getAll()).toHaveLength(0);
    });

    it('returns false when trying to remove a non-existent task', () => {
      const removed = taskService.remove('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('marks a task as done and sets completedAt timestamp', () => {
      const created = taskService.create({ title: 'Complete Me' });
      const completed = taskService.completeTask(created.id);

      expect(completed).toBeDefined();
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
      expect(new Date(completed.completedAt).toString()).not.toBe('Invalid Date');
    });

    it('preserves existing priority instead of overriding to medium (Bug Regression Test)', () => {
      const created = taskService.create({ title: 'Urgent Task', priority: 'high' });
      const completed = taskService.completeTask(created.id);

      expect(completed.priority).toBe('high');
    });

    it('returns null if task does not exist', () => {
      const completed = taskService.completeTask('non-existent-id');
      expect(completed).toBeNull();
    });
  });

  describe('assignTask', () => {
    it('assigns a user to a task', () => {
      const created = taskService.create({ title: 'Feature development' });
      const assigned = taskService.assignTask(created.id, 'Bhavish');

      expect(assigned).toBeDefined();
      expect(assigned.assignee).toBe('Bhavish');
      expect(taskService.findById(created.id).assignee).toBe('Bhavish');
    });

    it('trims leading and trailing whitespace from assignee name', () => {
      const created = taskService.create({ title: 'Code review' });
      const assigned = taskService.assignTask(created.id, '   Bhavish   ');

      expect(assigned.assignee).toBe('Bhavish');
    });

    it('reassigns a task if already assigned', () => {
      const created = taskService.create({ title: 'Bug triage', assignee: 'Alice' });
      const reassigned = taskService.assignTask(created.id, 'Bob');

      expect(reassigned.assignee).toBe('Bob');
    });

    it('returns null if task does not exist', () => {
      const assigned = taskService.assignTask('non-existent-id', 'Bhavish');
      expect(assigned).toBeNull();
    });
  });

  describe('_reset', () => {
    it('clears all tasks in the store', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      expect(taskService.getAll()).toHaveLength(2);

      taskService._reset();
      expect(taskService.getAll()).toHaveLength(0);
    });
  });
});
