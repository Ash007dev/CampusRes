"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

// Event types
export interface BookingUpdate {
  type: "CREATED" | "CANCELLED" | "CONFIRMED" | "COMPLETED";
  bookingId: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName?: string;
}

export interface RoomUpdate {
  type: "AVAILABLE" | "OCCUPIED";
  roomId: string;
  roomName: string;
}

export interface WaitlistUpdate {
  type: "ADDED" | "NOTIFIED" | "SLOT_AVAILABLE";
  roomId: string;
  roomName: string;
  position?: number;
  availableSlot?: {
    startTime: string;
    endTime: string;
  };
}

interface SocketEvents {
  "booking:update": (data: BookingUpdate) => void;
  "room:update": (data: RoomUpdate) => void;
  "waitlist:update": (data: WaitlistUpdate) => void;
  "notification": (data: { message: string; type: string }) => void;
}

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect) return;

    const token = localStorage.getItem("accessToken");

    socketRef.current = io(url, {
      auth: { token },
      reconnection,
      reconnectionAttempts,
      transports: ["websocket", "polling"],
    });

    // Connection handlers
    socketRef.current.on("connect", () => {
      setIsConnected(true);
      setError(null);
      onConnect?.();
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
      onDisconnect?.();
    });

    socketRef.current.on("connect_error", (err) => {
      setError(err);
      onError?.(err);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [
    url,
    autoConnect,
    reconnection,
    reconnectionAttempts,
    onConnect,
    onDisconnect,
    onError,
  ]);

  // Subscribe to events
  const subscribe = useCallback(
    <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
      if (!socketRef.current) return () => {};

      socketRef.current.on(event as string, handler as any);

      return () => {
        socketRef.current?.off(event as string, handler as any);
      };
    },
    []
  );

  // Emit events
  const emit = useCallback(
    <T = any>(event: string, data?: T) => {
      if (!socketRef.current) return;
      socketRef.current.emit(event, data);
    },
    []
  );

  // Join room (for room-specific updates)
  const joinRoom = useCallback((roomId: string) => {
    emit("room:join", { roomId });
  }, [emit]);

  // Leave room
  const leaveRoom = useCallback((roomId: string) => {
    emit("room:leave", { roomId });
  }, [emit]);

  // Manual connect
  const connect = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  // Manual disconnect
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    subscribe,
    emit,
    joinRoom,
    leaveRoom,
    connect,
    disconnect,
  };
}

// Hook for booking-specific updates
export function useBookingUpdates(
  onUpdate: (update: BookingUpdate) => void
) {
  const { subscribe, isConnected } = useSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe("booking:update", onUpdate);
    return unsubscribe;
  }, [subscribe, isConnected, onUpdate]);
}

// Hook for room-specific updates
export function useRoomUpdates(
  roomId: string,
  onUpdate: (update: RoomUpdate) => void
) {
  const { subscribe, joinRoom, leaveRoom, isConnected } = useSocket();

  useEffect(() => {
    if (!isConnected || !roomId) return;

    joinRoom(roomId);
    const unsubscribe = subscribe("room:update", (data) => {
      if (data.roomId === roomId) {
        onUpdate(data);
      }
    });

    return () => {
      unsubscribe();
      leaveRoom(roomId);
    };
  }, [subscribe, joinRoom, leaveRoom, roomId, isConnected, onUpdate]);
}

// Hook for waitlist updates
export function useWaitlistUpdates(
  onUpdate: (update: WaitlistUpdate) => void
) {
  const { subscribe, isConnected } = useSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe("waitlist:update", onUpdate);
    return unsubscribe;
  }, [subscribe, isConnected, onUpdate]);
}
