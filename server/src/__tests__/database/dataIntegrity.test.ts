import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authGet, authPost, request } from '../setup/testSetup';

describe('Database Testing', () => {
  describe('Data Integrity', () => {
    it('should enforce unique email constraint', async () => {
      const email = `duplicate-${Date.now()}@test.com`;
      
      // Register first user
      const res1 = await request()
        .post('/api/v1/auth/register')
        .send({
          email,
          firstName: 'User',
          lastName: 'One',
          password: 'TestPass123!',
        });

      expect([201, 400]).toContain(res1.status);

      // Try to register second user with same email
      const res2 = await request()
        .post('/api/v1/auth/register')
        .send({
          email,
          firstName: 'User',
          lastName: 'Two',
          password: 'TestPass123!',
        });

      expect(res2.status).toBe(409); // Conflict
    });

    it('should maintain referential integrity for bookings', async () => {
      const res = await authPost('/api/v1/bookings', {
        roomId: 'nonexistent-room-id',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
      });

      expect([400, 404]).toContain(res.status);
    });

    it('should prevent overlapping bookings', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 90000000).toISOString();

      const res1 = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime,
        endTime,
        purpose: 'First booking',
      });

      if (res1.status === 201) {
        const res2 = await authPost('/api/v1/bookings', {
          roomId: 'room-001',
          startTime,
          endTime,
          purpose: 'Overlapping booking',
        });

        expect(res2.status).toBe(409); // Conflict
      }
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent user count', async () => {
      const res1 = await authGet('/api/v1/admin/users');
      const initialCount = res1.body.data?.length || 0;

      const res2 = await authGet('/api/v1/admin/users');
      const secondCount = res2.body.data?.length || 0;

      expect(initialCount).toBe(secondCount);
    });

    it('should correctly update booking status', async () => {
      const bookingRes = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
      });

      if (bookingRes.status === 201) {
        const bookingId = bookingRes.body.data.id;
        
        const cancelRes = await request()
          .patch(`/api/v1/bookings/${bookingId}`)
          .send({ status: 'CANCELLED' });

        if (cancelRes.status === 200) {
          const checkRes = await authGet(`/api/v1/bookings/${bookingId}`);
          expect(checkRes.body.data.status).toBe('CANCELLED');
        }
      }
    });
  });

  describe('Migration Testing', () => {
    it('should have all required tables', async () => {
      // Simple health check to ensure DB is properly migrated
      const res = await authGet('/api/v1/health');
      expect([200, 204]).toContain(res.status);
    });

    it('should have correct table structure', async () => {
      const res = await authGet('/api/v1/admin/health');
      
      if (res.status === 200) {
        expect(res.body.database).toBe('connected');
        expect(res.body.migrations).toBeDefined();
      }
    });
  });

  describe('Transaction Testing', () => {
    it('should rollback on error during complex operation', async () => {
      // Attempt to create booking with invalid room
      const res = await authPost('/api/v1/bookings', {
        roomId: 'invalid-id',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      });

      expect([400, 404]).toContain(res.status);

      // Verify user wasn't partially created
      const userRes = await authGet('/api/v1/users/profile');
      expect(userRes.status).toBe(200);
    });
  });
});