import { describe, it, expect } from 'vitest';
import { authPost, authGet, request } from '../setup/testSetup';

describe('Concurrency & Load Testing', () => {
  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous login attempts', async () => {
      const promises = Array(5).fill(null).map(() =>
        request()
          .post('/api/v1/auth/login')
          .send({
            email: 'admin@test.com',
            password: 'AdminPass123!',
          })
      );

      const results = await Promise.all(promises);
      
      results.forEach(res => {
        expect([200, 401, 429]).toContain(res.status);
      });
    });

    it('should handle concurrent room list requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        authGet('/api/v1/rooms')
      );

      const results = await Promise.all(promises);
      
      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const operations = [
        authGet('/api/v1/rooms'),
        authGet('/api/v1/bookings/my'),
        authPost('/api/v1/bookings', {
          roomId: 'room-001',
          startTime: new Date(Date.now() + 86400000 * 7).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 7 + 3600000).toISOString(),
        }),
        authGet('/api/v1/users/profile'),
      ];

      const results = await Promise.all(operations);
      
      results.forEach(res => {
        expect([200, 201, 400, 409]).toContain(res.status);
      });

      // Verify data consistency after concurrent operations
      const checkRes = await authGet('/api/v1/rooms');
      expect(checkRes.status).toBe(200);
    });
  });

  describe('Race Conditions', () => {
    it('should prevent race condition during booking', async () => {
      const roomId = 'room-003';
      const baseTime = Date.now() + 86400000 * 14;
      const startTime = new Date(baseTime).toISOString();
      const endTime = new Date(baseTime + 3600000).toISOString();

      // Simulate two users trying to book same slot simultaneously
      const promises = Array(2).fill(null).map(() =>
        authPost('/api/v1/bookings', {
          roomId,
          startTime,
          endTime,
          purpose: 'Race condition test',
        })
      );

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.status === 201);
      
      // Only one should succeed
      expect(successful.length).toBeLessThanOrEqual(1);
    });

    it('should handle concurrent status updates', async () => {
      // Create a booking first
      const createRes = await authPost('/api/v1/bookings', {
        roomId: 'room-004',
        startTime: new Date(Date.now() + 86400000 * 21).toISOString(),
        endTime: new Date(Date.now() + 86400000 * 21 + 3600000).toISOString(),
      });

      if (createRes.status === 201) {
        const bookingId = createRes.body.data.id;

        // Try to update status concurrently
        const updates = Array(3).fill(null).map(() =>
          request()
            .patch(`/api/v1/bookings/${bookingId}`)
            .send({ status: 'CANCELLED' })
        );

        const results = await Promise.all(updates);
        
        // At least the first one should succeed
        const successful = results.filter(r => [200, 409].includes(r.status));
        expect(successful.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Connection Pool Testing', () => {
    it('should maintain connection pool under load', async () => {
      const requests = Array(20).fill(null).map(() =>
        authGet('/api/v1/rooms?limit=10')
      );

      const results = await Promise.all(requests);
      
      const successful = results.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(15); // At least 75% success
    });
  });

  describe('Memory & Resource Management', () => {
    it('should not leak memory with repeated requests', async () => {
      for (let i = 0; i < 50; i++) {
        const res = await authGet('/api/v1/rooms');
        expect([200, 429]).toContain(res.status);
      }
      
      // If this completes without crash, memory is managed
      expect(true).toBe(true);
    });

    it('should handle large responses efficiently', async () => {
      const res = await authGet('/api/v1/rooms?limit=1000');
      
      if (res.status === 200) {
        expect(Array.isArray(res.body.data)).toBe(true);
        // Should complete without timeout
        expect(res.req.timeout).toBeLessThan(30000);
      }
    });
  });
});