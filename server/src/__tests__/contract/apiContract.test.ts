import { describe, it, expect } from 'vitest';
import { request, authGet, authPost } from '../setup/testSetup';

describe('API Contract Testing', () => {
  const validateUserSchema = (user: any) => {
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('firstName');
    expect(user).toHaveProperty('lastName');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('departmentId');
    expect(typeof user.id).toBe('string');
    expect(typeof user.email).toBe('string');
  };

  const validateRoomSchema = (room: any) => {
    expect(room).toHaveProperty('id');
    expect(room).toHaveProperty('name');
    expect(room).toHaveProperty('code');
    expect(room).toHaveProperty('capacity');
    expect(room).toHaveProperty('buildingName');
    expect(typeof room.capacity).toBe('number');
    expect(room.capacity).toBeGreaterThan(0);
  };

  const validateBookingSchema = (booking: any) => {
    expect(booking).toHaveProperty('id');
    expect(booking).toHaveProperty('userId');
    expect(booking).toHaveProperty('roomId');
    expect(booking).toHaveProperty('status');
    expect(booking).toHaveProperty('startTime');
    expect(booking).toHaveProperty('endTime');
    expect(['CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED']).toContain(booking.status);
  };

  describe('User Endpoints Contract', () => {
    it('GET /api/v1/users/profile should return valid user schema', async () => {
      const res = await authGet('/api/v1/users/profile');
      
      if (res.status === 200) {
        expect(res.body.data).toBeDefined();
        validateUserSchema(res.body.data);
      }
    });

    it('POST /api/v1/auth/register should return user with tokens', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: `test-${Date.now()}@test.com`,
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPass123!',
        });

      if (res.status === 201) {
        expect(res.body.data).toHaveProperty('user');
        expect(res.body.data).toHaveProperty('tokens');
        expect(res.body.data.tokens).toHaveProperty('accessToken');
        validateUserSchema(res.body.data.user);
      }
    });
  });

  describe('Room Endpoints Contract', () => {
    it('GET /api/v1/rooms should return array of rooms', async () => {
      const res = await authGet('/api/v1/rooms');
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      
      if (res.body.data.length > 0) {
        res.body.data.forEach(validateRoomSchema);
      }
    });

    it('GET /api/v1/rooms/:id should return single room', async () => {
      const listRes = await authGet('/api/v1/rooms');
      
      if (listRes.status === 200 && listRes.body.data.length > 0) {
        const roomId = listRes.body.data[0].id;
        const res = await authGet(`/api/v1/rooms/${roomId}`);
        
        if (res.status === 200) {
          validateRoomSchema(res.body.data);
        }
      }
    });
  });

  describe('Booking Endpoints Contract', () => {
    it('GET /api/v1/bookings/my should return array of bookings', async () => {
      const res = await authGet('/api/v1/bookings/my');
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      
      if (res.body.data.length > 0) {
        res.body.data.forEach(validateBookingSchema);
      }
    });

    it('POST /api/v1/bookings should return booking with correct schema', async () => {
      const res = await authPost('/api/v1/bookings', {
        roomId: 'room-001',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        purpose: 'Test booking',
      });

      if (res.status === 201) {
        expect(res.body.data).toBeDefined();
        validateBookingSchema(res.body.data);
      }
    });
  });

  describe('Error Response Contract', () => {
    it('should return consistent error format', async () => {
      const res = await request()
        .get('/api/v1/invalid-endpoint');

      expect(res.body).toHaveProperty('success');
      expect(res.body.success).toBe(false);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('validation errors should include field details', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          firstName: '',
          lastName: '',
          password: '123',
        });

      if (res.status === 400) {
        expect(res.body).toHaveProperty('errors');
      }
    });
  });
});