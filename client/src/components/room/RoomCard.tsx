"use client";

import * as React from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  MapPin,
  Clock,
  Wifi,
  Monitor,
  Mic,
  Snowflake,
  Projector,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  Bell,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTimeInIst } from "@/lib/dateUtils";
import type { AvailabilityStatus } from "@/lib/api";

// Types
export interface Room {
  id: string;
  name: string;
  type: "LAB" | "LECTURE_HALL" | "MEETING_ROOM" | "SEMINAR_ROOM" | "CONFERENCE_ROOM";
  capacity: number;
  location: string;
  floor: string;
  building: string;
  amenities: string[];
  imageUrl?: string;
  isAvailable: boolean;
  availabilityStatus?: AvailabilityStatus;
  nextAvailable?: Date;
  nextBookingInHours?: number;
  departmentId?: string;
  departmentName?: string;
}

interface RoomCardProps {
  room: Room;
  onBook?: (room: Room) => void;
  onViewDetails?: (room: Room) => void;
  onNotify?: (room: Room) => void;
  isSelected?: boolean;
  isNotifying?: boolean;
  className?: string;
}

// Amenity icon mapping (handles both display names and API keys)
const AMENITY_ICONS: Record<string, React.ElementType> = {
  WiFi: Wifi,
  wifi: Wifi,
  Projector: Projector,
  projector: Projector,
  "Video Conference": Monitor,
  videoConference: Monitor,
  video_conference: Monitor,
  "Audio System": Mic,
  microphone: Mic,
  "Air Conditioning": Snowflake,
  ac: Snowflake,
  Whiteboard: LayoutGrid,
  whiteboard: LayoutGrid,
  smartBoard: Monitor,
  soundSystem: Mic,
  computers: Monitor,
  wheelchairAccessible: Users,
};

// Amenity label mapping for display
const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi",
  projector: "Projector",
  ac: "A/C",
  microphone: "Mic",
  videoConference: "Video",
  whiteboard: "Board",
  smartBoard: "Smart",
  soundSystem: "Sound",
  computers: "Lab",
  wheelchairAccessible: "♿",
};

// ... (keep the existing code between these sections)

// Room type colors - Grayscale palette with explicit text colors for visibility
const ROOM_TYPE_COLORS: Record<string, string> = {
  LAB: "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black",
  LECTURE_HALL: "bg-neutral-700 text-white dark:bg-neutral-300 dark:text-black",
  MEETING_ROOM: "bg-neutral-600 text-white dark:bg-neutral-400 dark:text-black",
  SEMINAR_ROOM: "bg-neutral-500 text-white dark:bg-neutral-500 dark:text-white",
  CONFERENCE_ROOM: "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black",
};

export function RoomCard({
  room,
  onBook,
  onViewDetails,
  onNotify,
  isSelected = false,
  isNotifying = false,
  className,
}: RoomCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Format room type for display (with fallback)
  const formattedType = (room.type || 'CLASSROOM').replace(/_/g, " ");

  // Get amenities with their availability status
  const amenitiesData = Array.isArray(room.amenities)
    ? room.amenities.map(name => ({ name, available: true }))
    : room.amenities && typeof room.amenities === 'object'
      ? Object.entries(room.amenities).map(([name, enabled]) => ({
        name,
        available: enabled as boolean
      }))
      : [];

  // Only show available amenities in the card
  const availableAmenities = amenitiesData.filter(a => a.available);
  const visibleAmenities = availableAmenities.slice(0, 4);
  const hiddenAmenitiesCount = Math.max(0, availableAmenities.length - 4);

  return (
    <TooltipProvider>
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="h-full"
      >
        <Card
          className={cn(
            "relative overflow-hidden transition-all duration-300 h-full flex flex-col",
            "hover:shadow-xl hover:shadow-primary/10",
            isSelected && "ring-2 ring-primary",
            isHovered && "shadow-lg",
            room.isAvailable && "hover:ring-1 hover:ring-green-500/50",
            className
          )}
        >
          {/* Gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10" />

          {/* Room Image */}
          <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900">
            {room.imageUrl || true ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={room.imageUrl || "/images/rooms/amrita_ab1.jpg"}
                alt={room.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <LayoutGrid className="h-16 w-16 text-slate-600" />
              </div>
            )}

            {/* Availability Badge with Pulse Animation for Live Occupancy (US 3.3) */}
            <div className="absolute right-3 top-3">
              {room.availabilityStatus === 'OCCUPIED' ? (
                <Badge variant="destructive" className="animate-pulse">
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-white animate-ping inline-block" />
                  <XCircle className="mr-1 h-3 w-3" />
                  Occupied
                </Badge>
              ) : room.availabilityStatus === 'PENDING_CHECKIN' ? (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white animate-pulse">
                  <Clock className="mr-1 h-3 w-3" />
                  Pending Check-in
                </Badge>
              ) : room.isAvailable ? (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Available
                  {room.nextBookingInHours && room.nextBookingInHours < 2 && (
                    <span className="ml-1 text-xs opacity-80">({room.nextBookingInHours}h)</span>
                  )}
                </Badge>
              ) : (
                <Badge variant="destructive" className="animate-pulse">
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-white animate-ping inline-block" />
                  <XCircle className="mr-1 h-3 w-3" />
                  Occupied
                </Badge>
              )}
            </div>

            {/* Room Type Badge */}
            <div className="absolute left-3 top-3">
              <Badge className={cn("font-semibold", ROOM_TYPE_COLORS[room.type])}>
                {formattedType}
              </Badge>
            </div>
          </div>

          <CardContent className="p-4">
            {/* Room Name */}
            <h3 className="mb-2 line-clamp-1 text-lg font-semibold">
              {room.name}
            </h3>

            {/* Location & Capacity */}
            <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {room.building}, Floor {room.floor}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{room.capacity} seats</span>
              </div>
            </div>

            {/* Next Available Time */}
            {!room.isAvailable && room.nextAvailable && (
              <div className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Next: {formatTimeInIst(room.nextAvailable)}
                </span>
              </div>
            )}

            {/* Amenities */}
            <div className="flex flex-wrap gap-2">
              {visibleAmenities.map((amenity) => {
                const IconComponent = AMENITY_ICONS[amenity.name];
                const label = AMENITY_LABELS[amenity.name] || amenity.name;
                return (
                  <Tooltip key={amenity.name}>
                    <TooltipTrigger asChild>
                      <div className="flex h-8 items-center justify-center rounded-full bg-secondary px-2">
                        {IconComponent ? (
                          <IconComponent className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">
                            {label}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{AMENITY_LABELS[amenity.name] || amenity.name}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {hiddenAmenitiesCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                      <span className="text-xs font-medium text-muted-foreground">
                        +{hiddenAmenitiesCount}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{availableAmenities.slice(4).map(a => a.name).join(", ")}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex gap-2 p-4 pt-0">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onViewDetails?.(room)}
            >
              View Details
            </Button>
            {room.isAvailable ? (
              <Button
                className="flex-1"
                onClick={() => onBook?.(room)}
              >
                Book Now
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => onNotify?.(room)}
                disabled={isNotifying}
              >
                {isNotifying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                Notify Me
              </Button>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}

export type { RoomCardProps };
