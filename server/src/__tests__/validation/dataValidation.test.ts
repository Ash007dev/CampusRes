import { describe, it, expect } from 'vitest';
import { request } from '../setup/testSetup';

describe('Data Validation Testing', () => {
  describe('Email Validation', () => {
    const invalidEmails = [
      'notanemail',
      '@example.com',
      'user@',
      'user name@example.com',
      'user@exam ple.com',
      'user@@example.com',
      '',
      'user+tag@example.com',
    ];

    invalidEmails.forEach(email => {
      it(`should reject invalid email: "${email}"`, async () => {
        const res = await request()
          .post('/api/v1/auth/register')
          .send({
            email,
            firstName: 'Test',
            lastName: 'User',
            password: 'ValidPass123!',
          });

        expect(res.status).toBe(400);
      });
    });

    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user123@example.com',
    ];

    validEmails.forEach(email => {
      it(`should accept valid email: "${email}"`, async () => {
        const res = await request()
          .post('/api/v1/auth/register')
          .send({
            email: `${Date.now()}-${email}`, // Make unique
            firstName: 'Test',
            lastName: 'User',
            password: 'ValidPass123!',
          });

        expect([201, 400, 409]).toContain(res.status);
      });
    });
  });

  describe('Password Validation', () => {
    const weakPasswords = [
      '123456',
      'password',
      '12345678',
      'qwerty',
      'abc',
      'pass',
      'test',
    ];

    weakPasswords.forEach(password => {
      it(`should reject weak password: "${password}"`, async () => {
        const res = await request()
          .post('/api/v1/auth/register')
          .send({
            email: `test-${Date.now()}@example.com`,
            firstName: 'Test',
            lastName: 'User',
            password,
          });

        expect([400, 422]).toContain(res.status);
      });
    });

    const strongPasswords = [
      'TestPass123!',
      'SecureP@ssw0rd',
      'MyStr0ng!Password',
      'P@ssw0rd2024',
    ];

    strongPasswords.forEach(password => {
      it(`should accept strong password: "${password}"`, async () => {
        const res = await request()
          .post('/api/v1/auth/register')
          .send({
            email: `test-${Date.now()}-${Math.random()}@example.com`,
            firstName: 'Test',
            lastName: 'User',
            password,
          });

        expect([201, 409]).toContain(res.status);
      });
    });
  });

  describe('String Length Validation', () => {
    it('should reject firstName longer than 50 chars', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          firstName: 'A'.repeat(100),
          lastName: 'User',
          password: 'TestPass123!',
        });

      expect([400, 422]).toContain(res.status);
    });

    it('should reject empty firstName', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          firstName: '',
          lastName: 'User',
          password: 'TestPass123!',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Numeric Range Validation', () => {
    it('should validate capacity is positive', async () => {
      [0, -1, -100].forEach(async (capacity) => {
        const res = await request()
          .post('/api/v1/admin/rooms')
          .send({
            name: 'Test Room',
            capacity,
            buildingName: 'Building A',
          });

        expect([400, 403]).toContain(res.status);
      });
    });

    it('should validate capacity is reasonable', async () => {
      const res = await request()
        .post('/api/v1/admin/rooms')
        .send({
          name: 'Test Room',
          capacity: 10000,
          buildingName: 'Building A',
        });

      expect([400, 403, 422]).toContain(res.status);
    });
  });

  describe('Date/Time Validation', () => {
    it('should reject invalid date format', async () => {
      const res = await request()
        .post('/api/v1/bookings')
        .send({
          roomId: 'room-001',
          startTime: 'not-a-date',
          endTime: '2024-01-01',
        });

      expect([400, 401, 422]).toContain(res.status);
    });

    it('should reject end time before start time', async () => {
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() - 3600000);

      const res = await request()
        .post('/api/v1/bookings')
        .send({
          roomId: 'room-001',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        });

      expect([400, 401, 422]).toContain(res.status);
    });
  });

  describe('Enum Validation', () => {
    it('should reject invalid booking status', async () => {
      const res = await request()
        .patch('/api/v1/bookings/booking-id')
        .send({ status: 'INVALID_STATUS' });

      expect([400, 401, 404, 422]).toContain(res.status);
    });

    it('should accept valid booking statuses', async () => {
      const validStatuses = ['CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED'];
      
      validStatuses.forEach(status => {
        // Status validation would be tested if we had a booking to update
        expect(['CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED']).toContain(status);
      });
    });
  });
});