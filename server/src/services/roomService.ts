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

  async setMaintenanceStatus(roomId: string, isMaintenance: boolean): Promise<Room> {
    const { data: room, error } = await supabase
      .from('rooms')
      .update({ is_maintenance: isMaintenance })
      .eq('id', roomId)
      .select()
      .single();

    if (error || !room) {
      throw new Error('Failed to update maintenance status');
    }

    logger.info({ roomId, isMaintenance }, 'Room maintenance status updated');
    return room;
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
