/**
 * =============================================================================
 * Campus Resource Engine - Shared Type Definitions
 * =============================================================================
 */

// =============================================================================
// User Types
// =============================================================================

export type Role = "STUDENT" | "FACULTY" | "ADMIN" | "LAB_ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId?: string;
  department?: Department;
  reputationScore: number;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number;
}

// =============================================================================
// Department Types
// =============================================================================

export interface Department {
  id: string;
  name: string;
  code: string;
  roomLockEnd?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Room Types
// =============================================================================

export type RoomType =
  | "LAB"
  | "LECTURE_HALL"
  | "MEETING_ROOM"
  | "SEMINAR_ROOM"
  | "CONFERENCE_ROOM";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  location: string;
  floor: string;
  building: string;
  amenities: string[];
  imageUrl?: string;
  departmentId?: string;
  department?: Department;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoomWithAvailability extends Room {
  isAvailable: boolean;
  nextAvailable?: string;
}

// =============================================================================
// Booking Types
// =============================================================================

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export type RecurringPattern = "DAILY" | "WEEKLY" | "BIWEEKLY";

export interface Booking {
  id: string;
  userId: string;
  user?: User;
  roomId: string;
  room?: Room;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  recurringEndDate?: string;
  parentBookingId?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingRequest {
  roomId: string;
  startTime: string;
  endTime: string;
  purpose: string;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  recurringEndDate?: string;
}

export interface BookingSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  booking?: Booking;
}

// =============================================================================
// Waitlist Types
// =============================================================================

export type WaitlistStatus = "WAITING" | "NOTIFIED" | "EXPIRED" | "BOOKED";

export interface WaitlistEntry {
  id: string;
  userId: string;
  user?: User;
  roomId: string;
  room?: Room;
  requestedStartTime: string;
  requestedEndTime: string;
  status: WaitlistStatus;
  position: number;
  notifiedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

// =============================================================================
// Audit Types
// =============================================================================

export interface AuditLog {
  id: string;
  userId?: string;
  user?: User;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// =============================================================================
// Filter Types
// =============================================================================

export interface RoomFilters {
  search?: string;
  type?: RoomType;
  departmentId?: string;
  building?: string;
  floor?: string;
  minCapacity?: number;
  maxCapacity?: number;
  amenities?: string[];
  availableNow?: boolean;
}

export interface BookingFilters {
  status?: BookingStatus;
  roomId?: string;
  startDate?: string;
  endDate?: string;
}

// =============================================================================
// Statistics Types
// =============================================================================

export interface DashboardStats {
  totalBookings: number;
  activeBookings: number;
  upcomingBookings: number;
  utilizationRate: number;
  weeklyQuotaUsed: number;
  weeklyQuotaLimit: number;
}

export interface AdminStats extends DashboardStats {
  totalUsers: number;
  totalRooms: number;
  noShowRate: number;
  popularRooms: Array<{
    roomId: string;
    roomName: string;
    bookingCount: number;
  }>;
}

// =============================================================================
// Socket Event Types
// =============================================================================

export interface BookingUpdateEvent {
  type: "CREATED" | "CANCELLED" | "CONFIRMED" | "COMPLETED";
  bookingId: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName?: string;
}

export interface RoomUpdateEvent {
  type: "AVAILABLE" | "OCCUPIED";
  roomId: string;
  roomName: string;
}

export interface WaitlistUpdateEvent {
  type: "ADDED" | "NOTIFIED" | "SLOT_AVAILABLE";
  roomId: string;
  roomName: string;
  position?: number;
  availableSlot?: {
    startTime: string;
    endTime: string;
  };
}

export interface NotificationEvent {
  message: string;
  type: "info" | "success" | "warning" | "error";
}
