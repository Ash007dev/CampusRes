/**
 * =============================================================================
 * Campus Resource Engine - API Client
 * =============================================================================
 * Axios-based API client with interceptors for auth and error handling
 * =============================================================================
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Create Axios instance with default configuration
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Increased to 30 seconds for slower operations
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - Add auth token
 */
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage (or your auth store)
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Helper to convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (typeof obj !== 'object') return obj;

  const transformed: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      transformed[camelKey] = transformKeys(obj[key]);
    }
  }
  return transformed;
}

/**
 * Response interceptor - Transform data and handle errors
 */
api.interceptors.response.use(
  (response) => {
    // Don't transform blob responses (like CSV exports)
    if (response.data instanceof Blob) {
      return response;
    }

    // Transform snake_case keys to camelCase in response data
    if (response.data) {
      response.data = transformKeys(response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        document.cookie = 'accessToken=; path=/; max-age=0';

        // Only redirect if not already on auth pages
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/auth/') && currentPath !== '/') {
          console.log('[API] Token expired, redirecting to login...');
          window.location.href = '/auth/login?expired=true';
          // Return a rejected promise that won't show error in console
          return new Promise(() => { });
        }
      }
    }

    // Transform error for consistent handling
    const data = error.response?.data as any;
    const status = error.response?.status;

    let errorMessage = 'An unexpected error occurred';
    let errorCode: string | undefined;
    let errorDetails: any | undefined;

    if (data?.error) {
      // Handle structured error object from server
      if (typeof data.error === 'string') {
        errorMessage = data.error;
      } else {
        errorMessage = data.error.message || errorMessage;
        errorCode = data.error.code;
        errorDetails = data.error.details;

        // If there are validation details, try to make the message more specific
        // But keep the details for the UI to use (e.g. conflict alternatives)
        if (errorDetails && !errorDetails.alternatives) {
          const firstErrorKey = Object.keys(errorDetails)[0];
          if (firstErrorKey && Array.isArray(errorDetails[firstErrorKey]) && errorDetails[firstErrorKey][0]) {
            // Only override message for validation errors, not for business logic errors like conflicts
            // that might have their own useful messages
            if (errorCode === 'VALIDATION_ERROR') {
              errorMessage = `${errorDetails[firstErrorKey][0]}`;
            }
          }
        }
      }
    } else if (data?.message) {
      // Handle simple message response
      errorMessage = data.message;
    } else if (error.message) {
      // Handle axios error message
      errorMessage = error.message;
    }

    // Return the custom ApiError with all details
    return Promise.reject(new ApiError(errorMessage, errorCode, errorDetails, status));
  }
);

/**
 * ApiError class to preserve server error details
 */
export class ApiError extends Error {
  public code?: string;
  public details?: any;
  public status?: number;

  constructor(message: string, code?: string, details?: any, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;

    // Maintain prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * API Response type
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * =============================================================================
 * API Methods
 * =============================================================================
 */

// MFA Login Response Types
export interface LoginInitiationResponse {
  requiresOtp: boolean;
  sessionId: string;
  email: string;
  userName: string;
  message: string;
}

// Auth
export const authApi = {
  // Step 1: Initiate login (returns userId for OTP verification)
  login: (email: string, password: string) =>
    api.post<ApiResponse<LoginInitiationResponse>>('/auth/login', { email, password }),

  // Step 2: Verify OTP and complete login
  verifyOtp: (sessionId: string, otp: string) =>
    api.post<ApiResponse<{ user: User; tokens: Tokens }>>('/auth/verify-otp', { sessionId, otp }),

  register: (data: RegisterData) =>
    api.post<ApiResponse<{ user: User; tokens: Tokens }>>('/auth/register', data),

  getMe: () =>
    api.get<ApiResponse<User>>('/auth/me'),

  getQuota: () =>
    api.get<ApiResponse<QuotaUsage>>('/auth/quota'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiResponse<{ success: boolean }>>('/auth/change-password', {
      currentPassword,
      newPassword
    }),

  updatePreferences: (preferences: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    bookingReminders?: boolean;
    weeklyDigest?: boolean;
    theme?: 'light' | 'dark' | 'system';
  }) =>
    api.put<ApiResponse<{ success: boolean }>>('/auth/preferences', preferences),

  deleteAccount: () =>
    api.delete<ApiResponse<{ success: boolean }>>('/auth/account'),

  // Forgot Password flow
  forgotPassword: (email: string) =>
    api.post<ApiResponse<{ sessionId: string; email: string; message: string; expiresIn: number }>>('/auth/forgot-password', { email }),

  verifyResetOtp: (sessionId: string, otp: string) =>
    api.post<ApiResponse<{ resetToken: string; message: string }>>('/auth/verify-reset-otp', { sessionId, otp }),

  resetPassword: (resetToken: string, newPassword: string, confirmPassword: string) =>
    api.post<ApiResponse<{ success: boolean }>>('/auth/reset-password', { resetToken, newPassword, confirmPassword }),
};

// Bookings
export const bookingsApi = {
  create: (data: CreateBookingData) =>
    api.post<ApiResponse<Booking>>('/bookings', data),

  createRecurring: (data: CreateRecurringBookingData) =>
    api.post<ApiResponse<Booking[]>>('/bookings/recurring', data),

  getMyBookings: (params?: BookingQueryParams) =>
    api.get<ApiResponse<Booking[]>>('/bookings/my', { params }),

  // Get all bookings for calendar view (shows all users' bookings)
  getCalendarBookings: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<Booking[]>>('/bookings/calendar', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Booking>>(`/bookings/${id}`),

  cancel: (id: string, reason?: string) =>
    api.delete<ApiResponse<Booking>>(`/bookings/${id}`, { data: { reason } }),

  getAvailability: (roomId: string, date: string) =>
    api.get<ApiResponse<Availability>>('/bookings/availability', { params: { roomId, date } }),

  checkIn: (id: string, qrCode: string, latitude?: number, longitude?: number) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/check-in`, { qrCode, latitude, longitude }),

  earlyCheckout: (id: string) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/early-checkout`),

  extendBooking: (id: string, additionalMinutes: number) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/extend`, { additionalMinutes }),

  reschedule: (id: string, startTime: string, endTime: string) =>
    api.put<ApiResponse<Booking>>(`/bookings/${id}/reschedule`, { startTime, endTime }),

  // Admin endpoints
  getAllBookings: (params?: BookingQueryParams) =>
    api.get<ApiResponse<Booking[]>>('/bookings/all', { params }),

  getPendingApprovals: () =>
    api.get<ApiResponse<Booking[]>>('/bookings/pending-approvals'),

  importTimetable: (entries: Array<{
    roomCode: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    title: string;
    description?: string;
    weeks: number;
  }>) =>
    api.post<ApiResponse<{ created: number; errors: any[] }>>('/bookings/import-timetable', { entries }),

  exportBookings: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/bookings/export', { params, responseType: 'blob' }),

  // Approve or reject a booking (admin)
  approveBooking: (id: string, data: { approved: boolean; reason?: string }) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/approve`, data),

  // US 3: Mark booking as running late
  runningLate: (id: string) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/running-late`),
};

// Rooms
export const roomsApi = {
  search: (params?: RoomQueryParams) =>
    api.get<ApiResponse<Room[]>>('/rooms', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Room>>(`/rooms/${id}`),

  getBestFit: (attendeeCount: number, params?: BestFitParams) =>
    api.get<ApiResponse<Room[]>>('/rooms/best-fit', {
      params: { attendeeCount, ...params }
    }),

  getByBuilding: () =>
    api.get<ApiResponse<Record<string, Room[]>>>('/rooms/by-building'),

  // Admin operations
  create: (data: Partial<Room>) =>
    api.post<ApiResponse<Room>>('/rooms', data),

  update: (id: string, data: Partial<Room>) =>
    api.patch<ApiResponse<Room>>(`/rooms/${id}`, data),

  // US 5.7: Room Maintenance Mode
  setMaintenance: (id: string, isMaintenance: boolean, reason?: string) =>
    api.patch<ApiResponse<{
      room: Room;
      cancelledBookings: number;
      affectedUsers: string[];
    }>>(`/rooms/${id}/maintenance`, { isMaintenance, reason }),

  // US 3.3: Get real-time availability status
  getAvailableNow: () =>
    api.get<ApiResponse<RoomWithAvailability[]>>('/rooms/available-now'),
};

// US 3.3: Room with real-time availability status
export type AvailabilityStatus = 'AVAILABLE' | 'PENDING_CHECKIN' | 'OCCUPIED';

export interface RoomWithAvailability extends Room {
  availabilityStatus: AvailabilityStatus;
  currentBooking?: {
    id: string;
    endTime: string;
    checkInStatus: string;
  };
  nextBookingInHours?: number;
}

// Waitlist (US 3.7)
export const waitlistApi = {
  join: (roomId: string, startTime: string, endTime: string) =>
    api.post<ApiResponse<{ id: string; position: number }>>('/waitlist', { roomId, startTime, endTime }),

  leave: (id: string) =>
    api.delete<ApiResponse<void>>(`/waitlist/${id}`),

  getMyEntries: () =>
    api.get<ApiResponse<Array<{
      id: string;
      roomId: string;
      roomName: string;
      desiredStartTime: string;
      desiredEndTime: string;
      position: number;
      createdAt: string;
    }>>>('/waitlist/my'),

  getPosition: (id: string) =>
    api.get<ApiResponse<{ position: number }>>(`/waitlist/${id}/position`),
};

// Admin API
export const adminApi = {
  // Get all users (for admin)
  getUsers: (params?: { page?: number; limit?: number; role?: string; search?: string }) =>
    api.get<ApiResponse<User[]>>('/auth/users', { params }),

  // Create a user (Admin only)
  createUser: (data: { email: string; firstName: string; lastName: string; role: string; departmentId?: string; password?: string }) =>
    api.post<ApiResponse<{ user: User; tempPassword?: string }>>('/auth/users', data),

  // Delete a user (Admin only)
  deleteUser: (userId: string) => api.delete<ApiResponse<null>>(`/auth/users/${userId}`),

  // Get dashboard stats
  getStats: () =>
    api.get<ApiResponse<{
      totalUsers: number;
      totalRooms: number;
      totalBookings: number;
      activeBookings: number;
      utilizationRate: number;
      noShowRate: number;
    }>>('/admin/stats'),

  // Get all bookings (for admin)
  getAllBookings: (params?: BookingQueryParams) =>
    api.get<ApiResponse<Booking[]>>('/bookings/all', { params }),

  // Get pending approvals (for admin)
  getPendingApprovals: () =>
    api.get<ApiResponse<Booking[]>>('/bookings/pending-approvals'),

  // Approve a booking
  approveBooking: (id: string) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/approve`, { bookingId: id, approved: true }),

  // Reject a booking
  rejectBooking: (id: string, reason?: string) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/approve`, { bookingId: id, approved: false, reason }),

  // Update user role (Admin only) - US 5.4
  updateUserRole: (userId: string, role: string) =>
    api.patch<ApiResponse<void>>(`/auth/users/${userId}/role`, { role }),

  // Get audit logs (US 4.9)
  getAuditLogs: (params?: { page?: number; limit?: number; userId?: string; action?: string }) =>
    api.get<ApiResponse<any[]>>('/admin/audit-logs', { params }),

  // Send broadcast email to all users (US 2)
  sendBroadcast: (data: { subject: string; message: string }) =>
    api.post<ApiResponse<{ recipientCount: number; successCount: number; failCount: number }>>('/admin/broadcast', data),
};

// Holiday API (US 5.5)
export const holidayApi = {
  // Get all holidays
  getHolidays: (params?: { startDate?: string; endDate?: string; type?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<Holiday[]>>('/holidays', { params }),

  // Get holidays in a date range
  getHolidaysInRange: (startDate: string, endDate: string) =>
    api.get<ApiResponse<Holiday[]>>('/holidays/range', { params: { startDate, endDate } }),

  // Check if a date is a holiday
  checkHoliday: (date: string) =>
    api.get<ApiResponse<{ isHoliday: boolean; holiday?: Holiday }>>(`/holidays/check/${date}`),

  // Add a new holiday (Admin only)
  addHoliday: (data: { date: string; name: string; type?: string; description?: string; isRecurring?: boolean }) =>
    api.post<ApiResponse<Holiday>>('/holidays', data),

  // Update a holiday (Admin only)
  updateHoliday: (id: string, data: { date?: string; name?: string; type?: string; description?: string; isRecurring?: boolean }) =>
    api.patch<ApiResponse<Holiday>>(`/holidays/${id}`, data),

  // Delete a holiday (Admin only)
  deleteHoliday: (id: string) =>
    api.delete<ApiResponse<void>>(`/holidays/${id}`),

  // Bulk delete holidays (Admin only)
  bulkDeleteHolidays: (ids: string[]) =>
    api.post<ApiResponse<void>>('/holidays/bulk-delete', { ids }),
};

// Holiday type
export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'HOLIDAY' | 'WEEKEND' | 'MAINTENANCE' | 'CUSTOM';
  description?: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * =============================================================================
 * Type Definitions
 * =============================================================================
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'FACULTY' | 'LAB_ADMIN' | 'ADMIN';
  departmentId: string;
  departmentName?: string;
  quotaLimitHours: number;
  reputationScore: number;
  creditsBalance: number;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string | null;
}

export interface QuotaUsage {
  usedHours: number;
  limitHours: number;
  remainingHours: number;
  weekStart: string;
  weekEnd: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId?: string;
  departmentCode?: string;
  role?: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  description?: string;
  capacity: number;
  floor: number;
  building: string;
  amenities: Record<string, boolean>;
  roomType: string;
  departmentId: string;
  isMaintenance: boolean;
  department?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  startTime: string;
  endTime: string;
  title?: string;
  description?: string;
  attendeeCount: number;
  status: string;
  checkInStatus: string;
  isRecurring: boolean;
  recurringGroupId?: string;
  creditsCharged: number;
  isPeakHours: boolean;
  room: Room;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    departmentId: string;
  };
}

export interface CreateBookingData {
  roomId: string;
  startTime: string;
  endTime: string;
  title?: string;
  description?: string;
  attendeeCount?: number;
}

export interface CreateRecurringBookingData extends CreateBookingData {
  recurring: {
    pattern: 'weekly';
    weeks: number;
  };
}

export interface BookingQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface RoomQueryParams {
  page?: number;
  limit?: number;
  departmentId?: string;
  minCapacity?: number;
  maxCapacity?: number;
  roomType?: string;
  amenities?: string;
  building?: string;
}

export interface BestFitParams {
  departmentId?: string;
  amenities?: string;
  date?: string;
}

export interface Availability {
  available: Array<{ start: string; end: string }>;
  booked: Array<{ start: string; end: string; status: string }>;
}

// Feedback types (US 5.8)
export type FeedbackCategory = 'AC_ISSUE' | 'CLEANLINESS' | 'EQUIPMENT' | 'NOISE' | 'LIGHTING' | 'OTHER';
export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type FeedbackPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Feedback {
  id: string;
  roomId: string;
  userId: string;
  bookingId?: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  adminNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
  room?: {
    id: string;
    name: string;
    code: string;
    building: string;
  };
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface FeedbackStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

// Feedback API (US 5.8)
export const feedbackApi = {
  // Get all feedback (admin only)
  getAll: (params?: {
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    roomId?: string;
    priority?: FeedbackPriority;
    page?: number;
    limit?: number;
  }) => api.get<ApiResponse<Feedback[]>>('/feedback', { params }),

  // Get feedback stats (admin only)
  getStats: () => api.get<ApiResponse<FeedbackStats>>('/feedback/stats'),

  // Get my feedback (current user)
  getMy: () => api.get<ApiResponse<Feedback[]>>('/feedback/my'),

  // Get feedback by ID
  getById: (id: string) => api.get<ApiResponse<Feedback>>(`/feedback/${id}`),

  // Submit feedback
  create: (data: {
    roomId: string;
    bookingId?: string;
    category: FeedbackCategory;
    title: string;
    description: string;
    priority?: FeedbackPriority;
  }) => api.post<ApiResponse<Feedback>>('/feedback', data),

  // Update feedback (admin only)
  update: (id: string, data: {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    adminNotes?: string;
  }) => api.patch<ApiResponse<Feedback>>(`/feedback/${id}`, data),

  // Delete feedback (admin only)
  delete: (id: string) => api.delete<ApiResponse<void>>(`/feedback/${id}`),
};

// ============================================================================
// Configuration API (US 5.9)
// ============================================================================

export type ConfigDataType = 'string' | 'number' | 'boolean' | 'json' | 'time';
export type ConfigCategory = 'general' | 'booking' | 'notification' | 'security';

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  dataType: ConfigDataType;
  description?: string;
  category: ConfigCategory;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface BookingConstraints {
  campusOpenTime: string;
  campusCloseTime: string;
  maxDurationHours: number;
  minDurationMinutes: number;
  bufferMinutes: number;
}

// Configuration API (US 5.9)
export const configApi = {
  // Get all configuration
  getAll: (params?: { category?: ConfigCategory }) =>
    api.get<ApiResponse<SystemConfig[]>>('/config', { params }),

  // Get configuration by key
  getByKey: (key: string) =>
    api.get<ApiResponse<{ key: string; value: any; dataType: ConfigDataType; description?: string }>>(`/config/${key}`),

  // Get booking time constraints (public)
  getBookingConstraints: () =>
    api.get<ApiResponse<BookingConstraints>>('/config/booking/constraints'),

  // Update configuration (admin only)
  update: (key: string, data: { value: string | number | boolean; description?: string }) =>
    api.patch<ApiResponse<SystemConfig>>(`/config/${key}`, data),

  // Create configuration (admin only)
  create: (data: {
    key: string;
    value: string | number | boolean;
    dataType: ConfigDataType;
    description?: string;
    category: ConfigCategory;
    isPublic?: boolean;
  }) => api.post<ApiResponse<SystemConfig>>('/config', data),

  // Delete configuration (admin only)
  delete: (key: string) =>
    api.delete<ApiResponse<void>>(`/config/${key}`),

  // Clear cache (admin only)
  clearCache: () =>
    api.post<ApiResponse<void>>('/config/cache/clear'),
};

