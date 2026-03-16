const request = require('supertest');
const app = require('../src/index');

describe('TaskFlow API', () => {
  describe('GET /health', () => {
    it('should return status OK', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('OK');
    });
  });

  describe('GET /api/tasks', () => {
    it('should return an array of tasks', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test Task', description: 'Test Desc', priority: 'high' });
      expect(res.statusCode).toBe(201);
      expect(res.body.title).toBe('Test Task');
    });
  });
});
