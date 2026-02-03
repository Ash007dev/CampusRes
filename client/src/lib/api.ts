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

/**
 * Recursively transform object keys from snake_case to camelCase
 */
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
          return new Promise(() => {});
        }
      }
    }

    // Transform error for consistent handling
    const errorMessage =
      (error.response?.data as { error?: { message?: string } })?.error?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(errorMessage));
  }
);

/**
 * API Response type
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
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

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: User; tokens: Tokens }>>('/auth/login', { email, password }),

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
    theme?: 'light' | 'dark' | 'system';
  }) =>
    api.put<ApiResponse<{ success: boolean }>>('/auth/preferences', preferences),
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
};

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
    api.post<ApiResponse<Booking>>(`/bookings/${id}/approve`, { approved: true }),

  // Reject a booking
  rejectBooking: (id: string, reason?: string) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/approve`, { approved: false, reason }),

  // Update user role (Admin only) - US 5.4
  updateUserRole: (userId: string, role: string) =>
    api.patch<ApiResponse<void>>(`/auth/users/${userId}/role`, { role }),
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
