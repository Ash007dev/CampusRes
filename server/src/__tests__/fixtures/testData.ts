/**
 * Test data fixtures for consistent testing
 */

export const mockUsers = {
  admin: {
    id: 'admin-id-123',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    departmentId: 'dept-1',
  },
  student: {
    id: 'student-id-456',
    email: 'student@test.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'STUDENT',
    departmentId: 'dept-2',
  },
  staff: {
    id: 'staff-id-789',
    email: 'staff@test.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'STAFF',
    departmentId: 'dept-1',
  },
};

export const mockRooms = {
  labA: {
    id: 'room-001',
    name: 'Lab A',
    code: 'LAB-A-101',
    capacity: 30,
    floorNumber: 1,
    buildingName: 'Science Building',
    departmentId: 'dept-1',
  },
  studyB: {
    id: 'room-002',
    name: 'Study Room B',
    code: 'STUDY-B-201',
    capacity: 10,
    floorNumber: 2,
    buildingName: 'Library',
    departmentId: 'dept-1',
  },
};

export const mockBookings = {
  confirmed: {
    id: 'booking-001',
    userId: 'student-id-456',
    roomId: 'room-001',
    status: 'CONFIRMED',
    startTime: new Date(Date.now() + 3600000).toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(),
    purpose: 'Study group',
  },
  pending: {
    id: 'booking-002',
    userId: 'student-id-456',
    roomId: 'room-002',
    status: 'PENDING',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 90000000).toISOString(),
    purpose: 'Meeting prep',
  },
};

export const mockBookingPatterns = {
  peakHours: {
    dayOfWeek: 'Monday',
    startHour: 14,
    endHour: 16,
    averageOccupancy: 0.85,
    confidenceScore: 0.92,
  },
};