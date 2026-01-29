"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type Event,
  type SlotInfo,
  type View,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { cn } from "@/lib/utils";

// Types
export interface BookingEvent extends Event {
  id: string;
  roomId: string;
  roomName: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  isOwner: boolean;
  userId: string;
  userName?: string;
  purpose?: string;
}

interface BookingCalendarProps {
  events: BookingEvent[];
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (event: BookingEvent) => void;
  onNavigate?: (date: Date) => void;
  onView?: (view: View) => void;
  defaultView?: View;
  defaultDate?: Date;
  selectable?: boolean;
  className?: string;
  loading?: boolean;
}

// Date-fns localizer setup
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Custom event component with status-based styling
const EventComponent: React.FC<{ event: BookingEvent }> = ({ event }) => {
  return (
    <div className="flex h-full flex-col overflow-hidden p-1">
      <div className="truncate text-xs font-medium">{event.roomName}</div>
      {event.purpose && (
        <div className="truncate text-xs opacity-80">{event.purpose}</div>
      )}
    </div>
  );
};

// Get event style based on status and ownership
const getEventStyle = (event: BookingEvent) => {
  const baseStyle: React.CSSProperties = {
    borderRadius: "4px",
    opacity: 1,
    border: "none",
    display: "block",
  };

  // Spec: Red for 'Booked' (others), Green for 'My Booking'
  if (event.isOwner) {
    return {
      ...baseStyle,
      backgroundColor: "#22c55e", // Green for user's own bookings
      color: "#ffffff",
    };
  }

  // Status-based colors for other bookings
  switch (event.status) {
    case "CONFIRMED":
      return {
        ...baseStyle,
        backgroundColor: "#ef4444", // Red for booked (others)
        color: "#ffffff",
      };
    case "PENDING":
      return {
        ...baseStyle,
        backgroundColor: "#f97316", // Orange for pending
        color: "#ffffff",
      };
    case "CANCELLED":
      return {
        ...baseStyle,
        backgroundColor: "#94a3b8", // Gray for cancelled
        color: "#ffffff",
        textDecoration: "line-through",
      };
    case "COMPLETED":
      return {
        ...baseStyle,
        backgroundColor: "#6366f1", // Indigo for completed
        color: "#ffffff",
      };
    default:
      return {
        ...baseStyle,
        backgroundColor: "#ef4444",
        color: "#ffffff",
      };
  }
};

export function BookingCalendar({
  events,
  onSelectSlot,
  onSelectEvent,
  onNavigate,
  onView,
  defaultView = "month",
  defaultDate = new Date(),
  selectable = true,
  className,
  loading = false,
}: BookingCalendarProps) {
  const [view, setView] = useState<View>(defaultView);
  const [date, setDate] = useState<Date>(defaultDate);

  // Handle navigation
  const handleNavigate = useCallback(
    (newDate: Date) => {
      setDate(newDate);
      onNavigate?.(newDate);
    },
    [onNavigate]
  );

  // Handle view change
  const handleViewChange = useCallback(
    (newView: View) => {
      setView(newView);
      onView?.(newView);
    },
    [onView]
  );

  // Handle event selection
  const handleSelectEvent = useCallback(
    (event: BookingEvent) => {
      onSelectEvent?.(event);
    },
    [onSelectEvent]
  );

  // Handle slot selection for creating new bookings
  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      if (onSelectSlot) {
        onSelectSlot(slotInfo);
      }
    },
    [onSelectSlot]
  );

  // Event styling based on status
  const eventStyleGetter = useCallback(
    (event: BookingEvent) => {
      return {
        style: getEventStyle(event),
      };
    },
    []
  );

  // Custom toolbar component
  const components = useMemo(
    () => ({
      event: EventComponent,
    }),
    []
  );

  // Slot styling for past slots
  const slotPropGetter = useCallback(
    (date: Date) => {
      const now = new Date();
      if (date < now) {
        return {
          style: {
            backgroundColor: "#f8fafc",
          },
        };
      }
      return {};
    },
    []
  );

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-[600px] items-center justify-center rounded-lg border bg-background",
          className
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">
            Loading calendar...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-[600px] rounded-lg border bg-background p-4", className)}>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span className="text-xs text-muted-foreground">My Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-red-500" />
          <span className="text-xs text-muted-foreground">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-orange-500" />
          <span className="text-xs text-muted-foreground">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-indigo-500" />
          <span className="text-xs text-muted-foreground">Completed</span>
        </div>
      </div>

      {/* Calendar */}
      <BigCalendar
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onNavigate={handleNavigate}
        onView={handleViewChange}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable={selectable}
        eventPropGetter={eventStyleGetter}
        slotPropGetter={slotPropGetter}
        components={components}
        step={30}
        timeslots={2}
        min={new Date(0, 0, 0, 6, 0, 0)} // 6 AM
        max={new Date(0, 0, 0, 22, 0, 0)} // 10 PM
        views={["month", "week", "day", "agenda"]}
        popup
        className="booking-calendar"
        style={{ height: "calc(100% - 40px)" }}
      />

      {/* Custom styles */}
      <style jsx global>{`
        .booking-calendar {
          font-family: var(--font-sans);
        }

        .booking-calendar .rbc-header {
          padding: 12px 8px;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--foreground));
          background: hsl(var(--muted));
          border-color: hsl(var(--border));
          text-align: center !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .booking-calendar .rbc-header + .rbc-header {
          border-left: 1px solid hsl(var(--border));
        }

        .booking-calendar .rbc-row-content {
          z-index: 4;
        }

        .booking-calendar .rbc-month-row {
          border-color: hsl(var(--border));
        }

        .booking-calendar .rbc-day-bg {
          transition: background-color 0.2s ease;
        }

        .booking-calendar .rbc-day-bg:hover {
          background: hsl(var(--accent) / 0.1);
        }

        .booking-calendar .rbc-today {
          background: hsl(var(--primary) / 0.1);
        }

        .booking-calendar .rbc-off-range-bg {
          background: hsl(var(--muted) / 0.5);
        }

        .booking-calendar .rbc-date-cell {
          padding: 4px 8px;
          text-align: right;
          font-size: 0.875rem;
        }

        .booking-calendar .rbc-date-cell.rbc-now {
          font-weight: 700;
          color: hsl(var(--primary));
        }

        .booking-calendar .rbc-event {
          padding: 3px 6px;
          font-size: 0.75rem;
          border-radius: 6px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .booking-calendar .rbc-event:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .booking-calendar .rbc-event:focus {
          outline: none;
          box-shadow: 0 0 0 2px hsl(var(--ring));
        }

        .booking-calendar .rbc-time-view,
        .booking-calendar .rbc-month-view {
          border-color: hsl(var(--border));
          border-radius: 8px;
          overflow: hidden;
        }

        .booking-calendar .rbc-time-content,
        .booking-calendar .rbc-time-header-content {
          border-color: hsl(var(--border));
        }

        .booking-calendar .rbc-timeslot-group {
          border-color: hsl(var(--border));
        }

        .booking-calendar .rbc-day-slot .rbc-time-slot {
          border-color: hsl(var(--border) / 0.5);
        }

        .booking-calendar .rbc-toolbar {
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 8px;
        }

        .booking-calendar .rbc-toolbar-label {
          font-weight: 600;
          font-size: 1.125rem;
          color: hsl(var(--foreground));
        }

        .booking-calendar .rbc-toolbar button {
          color: hsl(var(--foreground));
          border-color: hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.15s ease;
        }

        .booking-calendar .rbc-toolbar button:hover {
          background: hsl(var(--accent));
          border-color: hsl(var(--accent));
        }

        .booking-calendar .rbc-toolbar button.rbc-active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }

        .booking-calendar .rbc-current-time-indicator {
          background: hsl(var(--destructive));
          height: 2px;
        }

        .booking-calendar .rbc-show-more {
          color: hsl(var(--primary));
          font-size: 0.75rem;
          font-weight: 500;
          padding: 2px 4px;
          background: hsl(var(--primary) / 0.1);
          border-radius: 4px;
        }

        .booking-calendar .rbc-agenda-view table.rbc-agenda-table {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          overflow: hidden;
          width: 100%;
          table-layout: fixed;
        }

        .booking-calendar .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
          background: hsl(var(--muted));
          padding: 0.75rem;
          border-bottom: 1px solid hsl(var(--border));
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        /* Fix column widths for agenda view */
        .booking-calendar .rbc-agenda-view table.rbc-agenda-table thead > tr > th:nth-child(1),
        .booking-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr > td:nth-child(1) {
          width: 120px;
          min-width: 120px;
        }

        .booking-calendar .rbc-agenda-view table.rbc-agenda-table thead > tr > th:nth-child(2),
        .booking-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr > td:nth-child(2) {
          width: 180px;
          min-width: 180px;
        }

        .booking-calendar .rbc-agenda-view table.rbc-agenda-table thead > tr > th:nth-child(3),
        .booking-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr > td:nth-child(3) {
          width: auto;
        }

        .booking-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          padding: 0.75rem;
          border-bottom: 1px solid hsl(var(--border));
          vertical-align: middle;
        }

        .booking-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr:hover {
          background: hsl(var(--accent) / 0.5);
        }
      `}</style>
    </div>
  );
}

// Export types for consumers
export type { BookingCalendarProps };
