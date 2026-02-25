/**
 * =============================================================================
 * Campus Resource Engine - Room Service
 * =============================================================================
 * Room management using Supabase
 * Table: rooms (snake_case columns)
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { getCache, setCache } from '../lib/redis.js';
import { RoomNotFoundError } from '../utils/errors.js';
import { CACHE } from '../config/constants.js';
import { parseDbDate } from '../utils/dateUtils.js';
import type { CreateRoomInput, RoomQueryInput } from '../utils/validators.js';

interface Room {
  id: string;
  name: string;
  code: string;
  description: string | null;
  capacity: number;
  floor: number;
  building: string;
  amenities: Record<string, boolean>;
  room_type: string;
  is_maintenance: boolean;
  is_active: boolean;
  department_id: string;
  latitude: number | null;
  longitude: number | null;
  qr_code_secret: string | null;
  created_at: string;
  updated_at: string;
}

interface RoomWithDepartment extends Room {
  departments: { id: string; name: string; code: string };
}

export class RoomService {
  async createRoom(input: CreateRoomInput): Promise<Room> {
    logger.info({ roomCode: input.code }, 'Creating new room');

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        id: crypto.randomUUID(),
        name: input.name,
        code: input.code,
        description: input.description,
        capacity: input.capacity,
        floor: input.floor,
        building: input.building,
        amenities: input.amenities,
        room_type: input.roomType,
        department_id: input.departmentId,
        latitude: input.latitude,
        longitude: input.longitude,
        qr_code_secret: crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !room) {
      logger.error({ error }, 'Failed to create room');
      throw new Error('Failed to create room');
    }

    logger.info({ roomId: room.id }, 'Room created');
    return room;
  }

  async getRoomById(roomId: string): Promise<RoomWithDepartment | null> {
    const cacheKey = `${CACHE.KEYS.ROOM_DETAILS}${roomId}`;

    const cached = await getCache<RoomWithDepartment>(cacheKey);
    if (cached) {
      return cached;
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .select(`*, departments(id, name, code)`)
      .eq('id', roomId)
      .single();

    if (error || !room) {
      return null;
    }

    await setCache(cacheKey, room, CACHE.TTL.ROOM_DETAILS);
    return room as RoomWithDepartment;
  }

  async searchRooms(query: RoomQueryInput): Promise<{
    rooms: RoomWithDepartment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    let dbQuery = supabase
      .from('rooms')
      .select(`*, departments(id, name, code)`, { count: 'exact' })
      .eq('is_active', true);

    if (!query.includeMaintenace) {
      dbQuery = dbQuery.eq('is_maintenance', false);
    }
    if (query.departmentId) {
      dbQuery = dbQuery.eq('department_id', query.departmentId);
    }
    if (query.roomType) {
      dbQuery = dbQuery.eq('room_type', query.roomType);
    }
    if (query.building) {
      dbQuery = dbQuery.eq('building', query.building);
    }
    if (query.minCapacity) {
      dbQuery = dbQuery.gte('capacity', query.minCapacity);
    }
    if (query.maxCapacity) {
      dbQuery = dbQuery.lte('capacity', query.maxCapacity);
    }

    dbQuery = dbQuery
      .order('department_id', { ascending: true })
      .order('capacity', { ascending: true })
      .range(skip, skip + limit - 1);

    const { data: rooms, count, error } = await dbQuery;

    if (error) {
      logger.error({ error }, 'Failed to search rooms');
      return { rooms: [], total: 0, page, limit };
    }

    return {
      rooms: (rooms || []) as RoomWithDepartment[],
      total: count || 0,
      page,
      limit
    };
  }

  async findBestFitRooms(
    attendeeCount: number,
    options: { departmentId?: string; amenities?: string[]; date?: string } = {}
  ): Promise<Array<RoomWithDepartment & { wastage: number }>> {
    let dbQuery = supabase
      .from('rooms')
      .select(`*, departments(id, name, code)`)
      .eq('is_active', true)
      .eq('is_maintenance', false)
      .gte('capacity', attendeeCount);

    if (options.departmentId) {
      dbQuery = dbQuery.eq('department_id', options.departmentId);
    }

    const { data: rooms, error } = await dbQuery;

    if (error || !rooms) {
      return [];
    }

    const roomsWithWastage = rooms.map((room: any) => ({
      ...room,
      wastage: room.capacity - attendeeCount,
    }));

    roomsWithWastage.sort((a: any, b: any) => a.wastage - b.wastage);
    return roomsWithWastage;
  }

  async updateRoom(roomId: string, input: Partial<CreateRoomInput>): Promise<Room> {
    const { data: existing } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (!existing) {
      throw new RoomNotFoundError(roomId);
    }

    const updateData: Record<string, any> = {};
    if (input.name) updateData.name = input.name;
    if (input.code) updateData.code = input.code;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.capacity) updateData.capacity = input.capacity;
    if (input.floor !== undefined) updateData.floor = input.floor;
    if (input.building) updateData.building = input.building;
    if (input.amenities) updateData.amenities = input.amenities;
    if (input.roomType) updateData.room_type = input.roomType;
    if (input.latitude !== undefined) updateData.latitude = input.latitude;
    if (input.longitude !== undefined) updateData.longitude = input.longitude;

    const { data: updated, error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', roomId)
      .select()
      .single();

    if (error || !updated) {
      throw new Error('Failed to update room');
    }

    const cacheKey = `${CACHE.KEYS.ROOM_DETAILS}${roomId}`;
    await setCache(cacheKey, updated, CACHE.TTL.ROOM_DETAILS);

    return updated;
  }

  /**
   * Set room maintenance status (US 5.7)
   * When enabling maintenance, auto-cancels all future bookings
   */
  async setMaintenanceStatus(
    roomId: string,
    isMaintenance: boolean,
    maintenanceReason?: string
  ): Promise<{ room: Room; cancelledBookings: number; affectedUsers: string[] }> {
    // First, get room info
    const { data: existingRoom, error: fetchError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (fetchError || !existingRoom) {
      throw new Error('Room not found');
    }

    // Update maintenance status
    const updatePayload: Record<string, any> = {
      is_maintenance: isMaintenance,
      updated_at: new Date().toISOString(),
    };
    // Only set maintenance_reason if the column exists in the schema
    // Some DB setups may not have this column
    if (maintenanceReason) {
      updatePayload.description = `[MAINTENANCE] ${maintenanceReason}`;
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .update(updatePayload)
      .eq('id', roomId)
      .select()
      .single();

    if (error || !room) {
      throw new Error('Failed to update maintenance status');
    }

    let cancelledBookings = 0;
    const affectedUsers: string[] = [];

    // If enabling maintenance, cancel all future bookings
    if (isMaintenance) {
      const now = new Date().toISOString();

      // Get future bookings for this room
      const { data: futureBookings } = await supabase
        .from('bookings')
        .select('id, user_id, users(email, first_name, last_name)')
        .eq('room_id', roomId)
        .gt('start_time', now)
        .in('status', ['PENDING', 'CONFIRMED']);

      if (futureBookings && futureBookings.length > 0) {
        // Cancel all future bookings
        const bookingIds = futureBookings.map(b => b.id);

        const { error: cancelError } = await supabase
          .from('bookings')
          .update({
            status: 'CANCELLED',
            cancellation_reason: `Room under maintenance${maintenanceReason ? `: ${maintenanceReason}` : ''}`
          })
          .in('id', bookingIds);

        if (!cancelError) {
          cancelledBookings = futureBookings.length;

          // Collect affected user emails (unique)
          const userEmails = new Set<string>();
          futureBookings.forEach((b: any) => {
            if (b.users?.email) {
              userEmails.add(b.users.email);
            }
          });
          affectedUsers.push(...userEmails);
        }

        logger.info({
          roomId,
          cancelledBookings,
          affectedUsers
        }, 'Future bookings cancelled due to maintenance');
      }
    }

    logger.info({ roomId, isMaintenance, maintenanceReason }, 'Room maintenance status updated');

    return { room, cancelledBookings, affectedUsers };
  }

  async getDepartmentRooms(departmentId: string): Promise<Room[]> {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      return [];
    }

    return rooms || [];
  }

  /**
   * Get rooms with real-time availability status (US 3.3)
   * Returns availability state: AVAILABLE, PENDING_CHECKIN, or OCCUPIED
   */
  async getAvailableNowRooms(): Promise<Array<RoomWithDepartment & {
    availabilityStatus: 'AVAILABLE' | 'PENDING_CHECKIN' | 'OCCUPIED';
    currentBooking?: {
      id: string;
      startTime: string;
      endTime: string;
      checkInStatus: string;
    };
    nextBookingInHours?: number;
  }>> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Get all active rooms
    const { data: rooms, error: roomError } = await supabase
      .from('rooms')
      .select(`*, departments(id, name, code)`)
      .eq('is_active', true)
      .eq('is_maintenance', false);

    if (roomError || !rooms) {
      logger.error({ error: roomError }, 'Failed to fetch rooms');
      return [];
    }

    // Get all current and upcoming bookings (within next hour)
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, room_id, start_time, end_time, status, check_in_status')
      .in('status', ['CONFIRMED', 'PENDING_APPROVAL'])
      .lt('start_time', oneHourFromNow.toISOString())
      .gt('end_time', now.toISOString());

    if (bookingError) {
      logger.error({ error: bookingError }, 'Failed to fetch bookings');
    }

    const bookingsByRoom = new Map<string, any[]>();
    (bookings || []).forEach((b: any) => {
      const list = bookingsByRoom.get(b.room_id) || [];
      list.push(b);
      bookingsByRoom.set(b.room_id, list);
    });

    // Compute availability for each room
    const result = rooms.map((room: RoomWithDepartment) => {
      const roomBookings = bookingsByRoom.get(room.id) || [];

      // Find active booking (started and not ended)
      const activeBooking = roomBookings.find((b: any) => {
        const startTime = parseDbDate(b.start_time);
        const endTime = parseDbDate(b.end_time);
        return startTime <= now && endTime > now;
      });

      let availabilityStatus: 'AVAILABLE' | 'PENDING_CHECKIN' | 'OCCUPIED' = 'AVAILABLE';
      let currentBooking: any = undefined;

      if (activeBooking) {
        // Room has an active booking
        if (activeBooking.check_in_status === 'CHECKED_IN') {
          availabilityStatus = 'OCCUPIED';
        } else {
          // Booked but not checked in yet
          availabilityStatus = 'PENDING_CHECKIN';
        }
        currentBooking = {
          id: activeBooking.id,
          startTime: activeBooking.start_time,
          endTime: activeBooking.end_time,
          checkInStatus: activeBooking.check_in_status,
        };
      }

      // Calculate next booking time (for rooms that are currently available)
      let nextBookingInHours: number | undefined = undefined;
      if (availabilityStatus === 'AVAILABLE') {
        const futureBooking = roomBookings
          .filter((b: any) => parseDbDate(b.start_time) > now)
          .sort((a: any, b: any) => parseDbDate(a.start_time).getTime() - parseDbDate(b.start_time).getTime())[0];

        if (futureBooking) {
          const hoursUntilNext = (parseDbDate(futureBooking.start_time).getTime() - now.getTime()) / (1000 * 60 * 60);
          nextBookingInHours = Math.round(hoursUntilNext * 10) / 10;
        }
      }

      return {
        ...room,
        availabilityStatus,
        currentBooking,
        nextBookingInHours,
      };
    });

    return result;
  }

  async getRoomsByBuilding(): Promise<Record<string, Room[]>> {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('building', { ascending: true })
      .order('floor', { ascending: true })
      .order('code', { ascending: true });

    if (error || !rooms) {
      return {};
    }

    const grouped: Record<string, Room[]> = {};
    for (const room of rooms) {
      if (!grouped[room.building]) {
        grouped[room.building] = [];
      }
      grouped[room.building].push(room);
    }

    return grouped;
  }
}

export const roomService = new RoomService();
