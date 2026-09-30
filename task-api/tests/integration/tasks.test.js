const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

describe('Tasks API Integration Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    it('returns an empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all tasks in the store', async () => {
      taskService.create({ title: 'Task A' });
      taskService.create({ title: 'Task B' });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task A');
      expect(res.body[1].title).toBe('Task B');
    });

    it('filters tasks by status correctly', async () => {
      taskService.create({ title: 'Task Todo', status: 'todo' });
      taskService.create({ title: 'Task In Prog', status: 'in_progress' });
      taskService.create({ title: 'Task Done', status: 'done' });

      const resTodo = await request(app).get('/tasks?status=todo');
      expect(resTodo.status).toBe(200);
      expect(resTodo.body).toHaveLength(1);
      expect(resTodo.body[0].title).toBe('Task Todo');

      const resDone = await request(app).get('/tasks?status=done');
      expect(resDone.status).toBe(200);
      expect(resDone.body).toHaveLength(1);
      expect(resDone.body[0].title).toBe('Task Done');

      const resEmpty = await request(app).get('/tasks?status=nonexistent');
      expect(resEmpty.status).toBe(200);
      expect(resEmpty.body).toHaveLength(0);
    });

    it('paginates tasks with page and limit starting from first item on page 1', async () => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `Item ${i}` });
      }

      const resPage1 = await request(app).get('/tasks?page=1&limit=2');
      expect(resPage1.status).toBe(200);
      expect(resPage1.body).toHaveLength(2);
      expect(resPage1.body[0].title).toBe('Item 1');
      expect(resPage1.body[1].title).toBe('Item 2');

      const resPage2 = await request(app).get('/tasks?page=2&limit=2');
      expect(resPage2.status).toBe(200);
      expect(resPage2.body).toHaveLength(2);
      expect(resPage2.body[0].title).toBe('Item 3');
      expect(resPage2.body[1].title).toBe('Item 4');
    });

    it('handles default page and limit fallbacks when invalid query params are provided', async () => {
      for (let i = 1; i <= 3; i++) {
        taskService.create({ title: `Item ${i}` });
      }

      const res = await request(app).get('/tasks?page=abc&limit=xyz');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });
  });

  describe('GET /tasks/stats', () => {
    it('returns task counts and overdue count', async () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      const future = new Date(Date.now() + 3600000).toISOString();

      taskService.create({ title: 'Task 1', status: 'todo', dueDate: past });
      taskService.create({ title: 'Task 2', status: 'in_progress', dueDate: future });
      taskService.create({ title: 'Task 3', status: 'done', dueDate: past });

      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 1,
        in_progress: 1,
        done: 1,
        overdue: 1, // Only Task 1 is overdue because Task 3 is done
      });
    });
  });

  describe('POST /tasks', () => {
    it('creates a task successfully with valid title and defaults (201)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Write tests' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Write tests');
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
      expect(res.body.assignee).toBeNull();
      expect(res.body.completedAt).toBeNull();
      expect(res.body.createdAt).toBeDefined();
    });

    it('creates a task with all custom fields provided (201)', async () => {
      const payload = {
        title: 'Complete assignment',
        description: 'Take-home untangling',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-10-01T12:00:00.000Z',
      };

      const res = await request(app).post('/tasks').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe(payload.title);
      expect(res.body.description).toBe(payload.description);
      expect(res.body.status).toBe(payload.status);
      expect(res.body.priority).toBe(payload.priority);
      expect(res.body.dueDate).toBe(payload.dueDate);
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app).post('/tasks').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required and must be a non-empty string');
    });

    it('returns 400 when title is empty string or only whitespace', async () => {
      const resEmpty = await request(app).post('/tasks').send({ title: '' });
      expect(resEmpty.status).toBe(400);

      const resWhitespace = await request(app).post('/tasks').send({ title: '   ' });
      expect(resWhitespace.status).toBe(400);
    });

    it('returns 400 when status is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', status: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of:');
    });

    it('returns 400 when priority is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', priority: 'extreme' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of:');
    });

    it('returns 400 when dueDate is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', dueDate: 'not-a-date' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('PUT /tasks/:id', () => {
    it('updates an existing task (200)', async () => {
      const task = taskService.create({ title: 'Original Title', priority: 'low' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Updated Title', priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.priority).toBe('high');
      expect(res.body.status).toBe('todo'); // preserved
    });

    it('returns 404 when updating non-existent task', async () => {
      const res = await request(app)
        .put('/tasks/non-existent-id')
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('returns 400 when updating with invalid title', async () => {
      const task = taskService.create({ title: 'Original' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title must be a non-empty string');
    });

    it('returns 400 when updating with invalid status', async () => {
      const task = taskService.create({ title: 'Original' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ status: 'archived' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of:');
    });

    it('returns 400 when updating with invalid priority', async () => {
      const task = taskService.create({ title: 'Original' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ priority: 'super' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of:');
    });

    it('returns 400 when updating with invalid dueDate', async () => {
      const task = taskService.create({ title: 'Original' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ dueDate: 'invalid-date-format' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('deletes an existing task (204 No Content)', async () => {
      const task = taskService.create({ title: 'To Delete' });

      const res = await request(app).delete(`/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      // Verify it's actually removed
      const listRes = await request(app).get('/tasks');
      expect(listRes.body).toHaveLength(0);
    });

    it('returns 404 when deleting a non-existent task', async () => {
      const res = await request(app).delete('/tasks/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('marks a task as complete and sets completedAt (200)', async () => {
      const task = taskService.create({ title: 'Task to complete' });

      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
      expect(new Date(res.body.completedAt).toString()).not.toBe('Invalid Date');
    });

    it('preserves existing task priority on completion', async () => {
      const task = taskService.create({ title: 'High priority task', priority: 'high' });

      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.priority).toBe('high');
    });

    it('returns 404 when completing non-existent task', async () => {
      const res = await request(app).patch('/tasks/non-existent-id/complete');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    it('assigns a user to an existing task (200)', async () => {
      const task = taskService.create({ title: 'Task to assign' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Bhavish' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.assignee).toBe('Bhavish');

      // Verify persistence in service
      const fetched = taskService.findById(task.id);
      expect(fetched.assignee).toBe('Bhavish');
    });

    it('trims leading and trailing whitespace from assignee', async () => {
      const task = taskService.create({ title: 'Task whitespace assign' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '   Bhavish   ' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bhavish');
    });

    it('reassigns an already assigned task to a new user (200)', async () => {
      const task = taskService.create({ title: 'Task to reassign', assignee: 'Alice' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Bob' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    it('returns 404 when task does not exist', async () => {
      const res = await request(app)
        .patch('/tasks/non-existent-id/assign')
        .send({ assignee: 'Bhavish' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('returns 400 when assignee is missing from request body', async () => {
      const task = taskService.create({ title: 'Task missing assignee' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('returns 400 when assignee is empty string', async () => {
      const task = taskService.create({ title: 'Task empty assignee' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('returns 400 when assignee is whitespace-only string', async () => {
      const task = taskService.create({ title: 'Task whitespace assignee' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '     ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('returns 400 when assignee is not a string (number, boolean, null)', async () => {
      const task = taskService.create({ title: 'Task non-string assignee' });

      const resNum = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 12345 });
      expect(resNum.status).toBe(400);

      const resBool = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: true });
      expect(resBool.status).toBe(400);

      const resNull = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: null });
      expect(resNull.status).toBe(400);
    });
  });

  describe('Error Handling Middleware', () => {
    it('returns 500 when an unhandled server error occurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const originalCompleteTask = taskService.completeTask;
      taskService.completeTask = jest.fn().mockImplementationOnce(() => {
        throw new Error('Simulated database breakdown');
      });

      const res = await request(app).patch('/tasks/some-id/complete');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });

      taskService.completeTask = originalCompleteTask;
      consoleErrorSpy.mockRestore();
    });
  });

});
