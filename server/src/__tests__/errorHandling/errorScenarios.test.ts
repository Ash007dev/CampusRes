import { describe, it, expect } from 'vitest';
import { request, authPost, authGet } from '../setup/testSetup';

describe('Error Handling & Edge Cases', () => {
  describe('Input Validation', () => {
    it('should reject empty email', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: '',
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPass123!',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPass123!',
        });

      expect(res.status).toBe(400);
    });

    it('should reject weak passwords', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: `test-${Date.now()}@test.com`,
          firstName: 'Test',
          lastName: 'User',
          password: '123',
        });

      expect([400, 422]).toContain(res.status);
    });

    it('should reject negative capacity for rooms', async () => {
      const res = await authPost('/api/v1/admin/rooms', {
        name: 'Invalid Room',
        capacity: -5,
        buildingName: 'Building A',
      });

      expect([400, 403]).toContain(res.status);
    });

    it('should reject invalid date ranges for bookings', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 3600000).toISOString(); // Before start

      const res = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime,
        endTime,
      });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Null/Undefined Handling', () => {
    it('should handle null firstName', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: `test-${Date.now()}@test.com`,
          firstName: null,
          lastName: 'User',
          password: 'TestPass123!',
        });

      expect(res.status).toBe(400);
    });

    it('should handle missing optional fields', async () => {
      const res = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        // purpose is optional
      });

      expect([201, 400]).toContain(res.status);
    });
  });

  describe('Resource Not Found Handling', () => {
    it('should return 404 for non-existent user', async () => {
      const res = await authGet('/api/v1/users/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent room', async () => {
      const res = await authGet('/api/v1/rooms/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent booking', async () => {
      const res = await authGet('/api/v1/bookings/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('Type Validation', () => {
    it('should reject string for numeric capacity', async () => {
      const res = await authPost('/api/v1/admin/rooms', {
        name: 'Test Room',
        capacity: 'thirty',
        buildingName: 'Building A',
      });

      expect([400, 422]).toContain(res.status);
    });

    it('should reject invalid date format', async () => {
      const res = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime: 'invalid-date',
        endTime: 'invalid-date',
      });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Business Logic Errors', () => {
    it('should reject booking in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      
      const res = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime: pastDate,
        endTime: new Date(pastDate).toISOString(),
      });

      expect([400, 422]).toContain(res.status);
    });

    it('should reject booking longer than max duration', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 + 86400000 * 30).toISOString(); // 30 days

      const res = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime,
        endTime,
      });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Concurrent Access Errors', () => {
    it('should handle simultaneous booking attempts', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 90000000).toISOString();

      const promises = Array(3).fill(null).map(() =>
        authPost('/api/v1/bookings', {
          roomId: 'room-002',
          startTime,
          endTime,
          purpose: 'Concurrent test',
        })
      );

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.status === 201);
      
      // Only one should succeed
      expect(successful.length).toBeLessThanOrEqual(1);
    });
  });
});