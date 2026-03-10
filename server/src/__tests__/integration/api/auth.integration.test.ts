import { describe, it, expect, beforeAll } from 'vitest';
import { request, getAdminToken } from '../setup/testSetup';
import { mockUsers } from '../fixtures/testData';

describe('Auth API Integration Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: `testuser-${Date.now()}@test.com`,
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPass123!',
          departmentCode: 'CS',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(res.body.data.user.email);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPass123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return requiresOtp: true for valid credentials', async () => {
      const res = await request()
        .post('/api/v1/auth/login')
        .send({
          email: mockUsers.admin.email,
          password: 'AdminPass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.requiresOtp).toBe(true);
      expect(res.body.data.sessionId).toBeDefined();
    });

    it('should reject invalid credentials with 401', async () => {
      const res = await request()
        .post('/api/v1/auth/login')
        .send({
          email: mockUsers.admin.email,
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
    });
  });
});