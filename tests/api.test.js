const request = require('supertest');
const app = require('../server');

describe('OOPS Backend API Tests', () => {
  let sessionId;
  let candidateId = 'TEST_CANDIDATE_123';

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Health Check', () => {
    test('GET /health should return server status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('OOPS Backend is running');
    });
  });

  describe('Session Management', () => {
    test('POST /api/start-session should create a new session', async () => {
      const response = await request(app)
        .post('/api/start-session')
        .send({
          candidate_id: candidateId,
          name: 'Test Candidate',
          email: 'test@example.com',
          experience_level: 'mid',
          preferred_domains: ['data_structures']
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBeDefined();
      expect(response.body.data.first_question).toBeDefined();
      expect(response.body.data.first_question.question_text).toBeDefined();

      sessionId = response.body.data.session_id;
    });

    test('POST /api/evaluate-answer should evaluate an answer', async () => {
      if (!sessionId) {
        throw new Error('Session ID not available from previous test');
      }

      const response = await request(app)
        .post('/api/evaluate-answer')
        .send({
          session_id: sessionId,
          question_id: 'DS001',
          answer: 'A stack follows LIFO principle where elements are added and removed from the same end. A queue follows FIFO principle where elements are added at the rear and removed from the front.',
          candidate_id: candidateId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.evaluation).toBeDefined();
      expect(response.body.data.evaluation.correctness).toBeGreaterThanOrEqual(0);
      expect(response.body.data.evaluation.correctness).toBeLessThanOrEqual(1);
      expect(response.body.data.evaluation.feedback).toBeDefined();
    });

    test('POST /api/end-session should end the session', async () => {
      if (!sessionId) {
        throw new Error('Session ID not available from previous test');
      }

      const response = await request(app)
        .post('/api/end-session')
        .send({
          session_id: sessionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_summary).toBeDefined();
      expect(response.body.data.report).toBeDefined();
    });

    test('GET /api/session/:session_id should return session details', async () => {
      if (!sessionId) {
        throw new Error('Session ID not available from previous test');
      }

      const response = await request(app)
        .get(`/api/session/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBe(sessionId);
      expect(response.body.data.candidate_id).toBe(candidateId);
    });
  });

  describe('Validation', () => {
    test('POST /api/start-session should validate required fields', async () => {
      const response = await request(app)
        .post('/api/start-session')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation error');
    });

    test('POST /api/evaluate-answer should validate required fields', async () => {
      const response = await request(app)
        .post('/api/evaluate-answer')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation error');
    });
  });

  describe('Error Handling', () => {
    test('GET /api/session/nonexistent should return 404', async () => {
      const response = await request(app)
        .get('/api/session/NONEXISTENT')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Session not found');
    });

    test('POST /api/evaluate-answer with invalid session should return 404', async () => {
      const response = await request(app)
        .post('/api/evaluate-answer')
        .send({
          session_id: 'INVALID_SESSION',
          question_id: 'DS001',
          answer: 'Test answer',
          candidate_id: candidateId
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Session not found');
    });
  });
});
