/**
 * =============================================================================
 * Campus Resource Engine - Socket.io Server
 * =============================================================================
 * Handles real-time WebSocket connections for live updates
 * =============================================================================
 */

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

// Types
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface BookingUpdatePayload {
  type: "CREATED" | "CANCELLED" | "CONFIRMED" | "COMPLETED";
  bookingId: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName?: string;
}

interface RoomUpdatePayload {
  type: "AVAILABLE" | "OCCUPIED";
  roomId: string;
  roomName: string;
}

interface WaitlistUpdatePayload {
  type: "ADDED" | "NOTIFIED" | "SLOT_AVAILABLE" | "SLOT_EXPIRED";
  roomId: string;
  roomName: string;
  position?: number;
  availableSlot?: {
    startTime: string;
    endTime: string;
  };
  /** ISO timestamp when the user's booking window expires (cascade mode) */
  expiresAt?: string;
  /** Minutes the user has to book before cascading to the next person */
  windowMinutes?: number;
}

// Socket.io server instance
let io: Server;

/**
 * Initialize Socket.io server
 */
export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        role: string;
      };

      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      next();
    } catch (error) {
      logger.error("Socket authentication failed:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket: AuthenticatedSocket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);

    // Join user's personal room for direct notifications
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Join room for real-time updates
    socket.on("room:join", ({ roomId }: { roomId: string }) => {
      socket.join(`room:${roomId}`);
      logger.debug(`Socket ${socket.id} joined room:${roomId}`);
    });

    // Leave room
    socket.on("room:leave", ({ roomId }: { roomId: string }) => {
      socket.leave(`room:${roomId}`);
      logger.debug(`Socket ${socket.id} left room:${roomId}`);
    });

    // Admin: Join all rooms for global updates
    if (socket.userRole === "ADMIN" || socket.userRole === "LAB_ADMIN") {
      socket.join("admin");
    }

    // Disconnect handler
    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });

    // Error handler
    socket.on("error", (error) => {
      logger.error(`Socket error: ${socket.id}`, error);
    });
  });

  logger.info("Socket.io server initialized");
  return io;
}

/**
 * Get Socket.io server instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

/**
 * Emit booking update to relevant rooms
 */
export function emitBookingUpdate(payload: BookingUpdatePayload): void {
  if (!io) return;

  // Emit to the specific room
  io.to(`room:${payload.roomId}`).emit("booking:update", payload);

  // Emit to the user
  io.to(`user:${payload.userId}`).emit("booking:update", payload);

  // Emit to admins
  io.to("admin").emit("booking:update", payload);

  logger.debug(`Emitted booking:update for booking ${payload.bookingId}`);
}

/**
 * Emit room availability update
 */
export function emitRoomUpdate(payload: RoomUpdatePayload): void {
  if (!io) return;

  // Emit to the specific room
  io.to(`room:${payload.roomId}`).emit("room:update", payload);

  // Emit to all connected clients for real-time availability
  io.emit("room:update", payload);

  logger.debug(`Emitted room:update for room ${payload.roomId}`);
}

/**
 * Emit waitlist update to user
 */
export function emitWaitlistUpdate(
  userId: string,
  payload: WaitlistUpdatePayload
): void {
  if (!io) return;

  io.to(`user:${userId}`).emit("waitlist:update", payload);

  logger.debug(`Emitted waitlist:update to user ${userId}`);
}

/**
 * Send notification to specific user
 */
export function sendNotification(
  userId: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info"
): void {
  if (!io) return;

  io.to(`user:${userId}`).emit("notification", { message, type });

  logger.debug(`Sent notification to user ${userId}: ${message}`);
}

/**
 * Broadcast to all connected clients
 */
export function broadcast(event: string, data: unknown): void {
  if (!io) return;

  io.emit(event, data);

  logger.debug(`Broadcast event: ${event}`);
}

export { io };
