const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
  VALID_STATUSES,
  VALID_PRIORITIES,
} = require('../../src/utils/validators');

describe('Validators Unit Tests', () => {
  describe('Constants', () => {
    it('defines valid statuses and priorities', () => {
      expect(VALID_STATUSES).toEqual(['todo', 'in_progress', 'done']);
      expect(VALID_PRIORITIES).toEqual(['low', 'medium', 'high']);
    });
  });

  describe('validateCreateTask', () => {
    it('returns null for valid minimum task input', () => {
      const result = validateCreateTask({ title: 'Finish assignment' });
      expect(result).toBeNull();
    });

    it('returns null for valid complete task input', () => {
      const result = validateCreateTask({
        title: 'Finish assignment',
        description: 'Take-home assessment',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59.000Z',
      });
      expect(result).toBeNull();
    });

    it('returns error when body is null or not an object', () => {
      expect(validateCreateTask(null)).toBe('request body must be an object');
      expect(validateCreateTask(undefined)).toBe('request body must be an object');
      expect(validateCreateTask('string')).toBe('request body must be an object');
    });

    it('returns error when title is missing', () => {
      const result = validateCreateTask({});
      expect(result).toBe('title is required and must be a non-empty string');
    });

    it('returns error when title is not a string', () => {
      expect(validateCreateTask({ title: 123 })).toBe(
        'title is required and must be a non-empty string'
      );
      expect(validateCreateTask({ title: true })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is empty or only whitespace', () => {
      expect(validateCreateTask({ title: '' })).toBe(
        'title is required and must be a non-empty string'
      );
      expect(validateCreateTask({ title: '   ' })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when status is invalid', () => {
      const result = validateCreateTask({ title: 'Task', status: 'invalid_status' });
      expect(result).toBe('status must be one of: todo, in_progress, done');
    });

    it('accepts all valid statuses', () => {
      VALID_STATUSES.forEach((status) => {
        expect(validateCreateTask({ title: 'Task', status })).toBeNull();
      });
    });

    it('returns error when priority is invalid', () => {
      const result = validateCreateTask({ title: 'Task', priority: 'critical' });
      expect(result).toBe('priority must be one of: low, medium, high');
    });

    it('accepts all valid priorities', () => {
      VALID_PRIORITIES.forEach((priority) => {
        expect(validateCreateTask({ title: 'Task', priority })).toBeNull();
      });
    });

    it('returns error when dueDate is not a valid date string', () => {
      const result = validateCreateTask({ title: 'Task', dueDate: 'invalid-date' });
      expect(result).toBe('dueDate must be a valid ISO date string');
    });

    it('accepts valid date string formats for dueDate', () => {
      expect(validateCreateTask({ title: 'Task', dueDate: '2026-10-15' })).toBeNull();
      expect(
        validateCreateTask({ title: 'Task', dueDate: '2026-10-15T12:00:00.000Z' })
      ).toBeNull();
    });
  });

  describe('validateUpdateTask', () => {
    it('returns null for an empty update body', () => {
      const result = validateUpdateTask({});
      expect(result).toBeNull();
    });

    it('returns null for valid partial updates', () => {
      expect(validateUpdateTask({ title: 'Updated Title' })).toBeNull();
      expect(validateUpdateTask({ status: 'done' })).toBeNull();
      expect(validateUpdateTask({ priority: 'low' })).toBeNull();
      expect(validateUpdateTask({ dueDate: '2026-11-20T00:00:00.000Z' })).toBeNull();
    });

    it('returns error when body is null or not an object', () => {
      expect(validateUpdateTask(null)).toBe('request body must be an object');
      expect(validateUpdateTask(undefined)).toBe('request body must be an object');
    });

    it('returns error when title is provided but invalid', () => {
      expect(validateUpdateTask({ title: '' })).toBe('title must be a non-empty string');
      expect(validateUpdateTask({ title: '   ' })).toBe('title must be a non-empty string');
      expect(validateUpdateTask({ title: 456 })).toBe('title must be a non-empty string');
    });

    it('returns error when status is invalid', () => {
      const result = validateUpdateTask({ status: 'not_started' });
      expect(result).toBe('status must be one of: todo, in_progress, done');
    });

    it('returns error when priority is invalid', () => {
      const result = validateUpdateTask({ priority: 'urgent' });
      expect(result).toBe('priority must be one of: low, medium, high');
    });

    it('returns error when dueDate is invalid', () => {
      const result = validateUpdateTask({ dueDate: 'not-a-valid-date' });
      expect(result).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('validateAssignTask', () => {
    it('returns null for valid assignee name', () => {
      const result = validateAssignTask({ assignee: 'Bhavish' });
      expect(result).toBeNull();
    });

    it('returns error when body is null or not an object', () => {
      expect(validateAssignTask(null)).toBe('request body must be an object');
      expect(validateAssignTask(undefined)).toBe('request body must be an object');
      expect(validateAssignTask('Bhavish')).toBe('request body must be an object');
    });

    it('returns error when assignee is missing', () => {
      const result = validateAssignTask({});
      expect(result).toBe('assignee is required and must be a non-empty string');
    });

    it('returns error when assignee is not a string', () => {
      expect(validateAssignTask({ assignee: 123 })).toBe(
        'assignee is required and must be a non-empty string'
      );
      expect(validateAssignTask({ assignee: null })).toBe(
        'assignee is required and must be a non-empty string'
      );
      expect(validateAssignTask({ assignee: {} })).toBe(
        'assignee is required and must be a non-empty string'
      );
    });

    it('returns error when assignee is an empty string', () => {
      const result = validateAssignTask({ assignee: '' });
      expect(result).toBe('assignee is required and must be a non-empty string');
    });

    it('returns error when assignee is whitespace only', () => {
      const result = validateAssignTask({ assignee: '    ' });
      expect(result).toBe('assignee is required and must be a non-empty string');
    });
  });
});
