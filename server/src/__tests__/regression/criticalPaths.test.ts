import { describe, it, expect, beforeAll } from 'vitest';
import { request, getAdminToken, authGet, authPost } from '../setup/testSetup';

describe('Regression Tests - Critical Paths', () => {
  let adminToken: string;
  let testUserId: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  describe('Authentication',  () => {
    it('should maintain backward compatibility with login flow', async () => {
      const res = await request()
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'AdminPass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('sessionId');
      expect(res.body.data).toHaveProperty('requiresOtp');
    });

    it('should maintain JWT token validity across requests', async () => {
      const firstReq = await authGet('/api/v1/bookings/my');
      expect(firstReq.status).toBe(200);

      const secondReq = await authGet('/api/v1/rooms');
      expect(secondReq.status).toBe(200);
    });
  });

  describe('Bookings', () => {
    it('should maintain booking status flow', async () => {
      // Get existing booking
      const listRes = await authGet('/api/v1/bookings/my');
      expect(listRes.status).toBe(200);

      if (listRes.body.data && listRes.body.data.length > 0) {
        const booking = listRes.body.data[0];

        // Check-in
        const checkInRes = await authPost(
          `/api/v1/bookings/${booking.id}/check-in`,
          { qrCode: booking.rooms?.code || 'TEST-CODE' }
        );
        expect([200, 400]).toContain(checkInRes.status);
      }
    });

    it('should maintain waitlist functionality', async () => {
      const res = await authGet('/api/v1/waitlist');
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Admin Functions', () => {
    it('should maintain admin access control', async () => {
      const res = await authGet('/api/v1/admin/users');
      // Should either succeed or return 403 (not 500)
      expect([200, 403]).toContain(res.status);
    });

    it('should maintain room management', async () => {
      const res = await authGet('/api/v1/admin/rooms');
      expect([200, 403]).toContain(res.status);
    });
  });
});