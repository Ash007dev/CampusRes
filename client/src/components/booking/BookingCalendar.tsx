"use client";

import * as React from "react";
import { useCallback, useMemo, useState, useEffect } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type Event,
  type SlotInfo,
  type View,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { cn } from "@/lib/utils";
import { holidayApi, type Holiday } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

// Types
export interface BookingEvent extends Event {
  id: string;
  roomId: string;
  roomName: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  checkInStatus?: "PENDING" | "CHECKED_IN" | "MISSED" | "NOT_REQUIRED";
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
  const isCancelledOrNoShow = event.status === 'CANCELLED' || event.status === 'NO_SHOW';
  return (
    <div className="flex h-full flex-col overflow-hidden p-1">
      <div className={cn("truncate text-xs font-semibold leading-tight", isCancelledOrNoShow && "line-through")}>{event.roomName}</div>
      {event.purpose && (
        <div className={cn("truncate text-xs leading-tight mt-0.5", isCancelledOrNoShow && "line-through")}>{event.purpose}</div>
      )}
    </div>
  );
};

// Get event style based on status and ownership
const getEventStyle = (event: BookingEvent) => {
  const baseStyle: React.CSSProperties = {
    borderRadius: "6px",
    opacity: 1,
    display: "block",
    fontSize: "0.75rem",
    padding: "4px 6px",
    borderWidth: "1px",
    borderStyle: "solid",
    fontWeight: "500",
  };

  // Use distinct colors that work with black/white theme
  if (event.isOwner) {
    // My bookings: Dark with bright white text
    return {
      ...baseStyle,
      backgroundColor: "#0a0a0a",
      color: "#ffffff",
      borderColor: "#262626",
      fontWeight: "600",
    };
  }

  // Status-based styles for other bookings
  switch (event.status) {
    case "CONFIRMED":
      // Others' bookings: Medium gray with white text
      return {
        ...baseStyle,
        backgroundColor: "#404040",
        color: "#ffffff",
        borderColor: "#525252",
      };
    case "PENDING":
      // Pending: Light gray with dark text
      return {
        ...baseStyle,
        backgroundColor: "#d4d4d4",
        color: "#0a0a0a",
        borderColor: "#a3a3a3",
        fontWeight: "600",
      };
    case "CANCELLED":
      return {
        ...baseStyle,
        backgroundColor: "#f5f5f5",
        color: "#525252",
        borderColor: "#d4d4d4",
        textDecoration: "line-through",
        opacity: 0.6,
      };
    case "NO_SHOW":
      return {
        ...baseStyle,
        backgroundColor: "#fef2f2",
        color: "#991b1b",
        borderColor: "#fca5a5",
        textDecoration: "line-through",
        opacity: 0.6,
      };
    case "COMPLETED":
      // Completed: Outlined style
      return {
        ...baseStyle,
        backgroundColor: "#fafafa",
        color: "#525252",
        borderColor: "#a3a3a3",
        borderStyle: "dashed",
        borderWidth: "2px",
      };
    default:
      return {
        ...baseStyle,
        backgroundColor: "#404040",
        color: "#ffffff",
        borderColor: "#525252",
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
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const { toast } = useToast();

  // Helper to format date as YYYY-MM-DD in IST
  const formatDateString = (d: Date): string => {
    // API expects YYYY-MM-DD. Using local time might be off by a day if early morning/late night.
    // Ideally we want the date in IST.
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(d);
    // en-CA is YYYY-MM-DD.
    // But formatToParts is safer.
    // Or just use the simple split trick on a toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }) which is YYYY-MM-DD
    return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
  };

  // Fetch holidays when month changes
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        // Fetch holidays for current month plus/minus one month for navigation
        const start = startOfMonth(subMonths(date, 1));
        const end = endOfMonth(addMonths(date, 1));
        const response = await holidayApi.getHolidays({
          startDate: formatDateString(start),
          endDate: formatDateString(end)
        });
        setHolidays(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch holidays:', error);
      }
    };
    fetchHolidays();
  }, [date]);

  // Check if a date is a holiday
  const isHoliday = useCallback((checkDate: Date): Holiday | undefined => {
    return holidays.find(h => isSameDay(new Date(h.date), checkDate));
  }, [holidays]);

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
      // Check if selected date is a holiday
      const holiday = isHoliday(slotInfo.start);
      if (holiday) {
        const dateStr = slotInfo.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        toast({
          title: "Cannot book on holiday",
          description: `${dateStr} is a holiday: ${holiday.name}`,
          variant: "destructive",
        });
        return;
      }
      if (onSelectSlot) {
        onSelectSlot(slotInfo);
      }
    },
    [onSelectSlot, isHoliday, toast]
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

  // Slot styling for past slots and holidays
  const slotPropGetter = useCallback(
    (slotDate: Date) => {
      const now = new Date();
      const holiday = isHoliday(slotDate);

      if (holiday) {
        // Holiday styling - red tint
        return {
          style: {
            backgroundColor: holiday.type === 'WEEKEND' ? '#fef3c7' : '#fee2e2',
          },
        };
      }

      if (slotDate < now) {
        return {
          style: {
            backgroundColor: "#f8fafc",
          },
        };
      }
      return {};
    },
    [isHoliday]
  );

  // Day styling for month view (colors entire day cell)
  const dayPropGetter = useCallback(
    (dayDate: Date) => {
      const holiday = isHoliday(dayDate);

      if (holiday) {
        return {
          className: 'holiday-day',
          style: {
            backgroundColor: holiday.type === 'WEEKEND' ? '#fef3c7' : '#fee2e2',
          },
        };
      }
      return {};
    },
    [isHoliday]
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
    <div className={cn("h-[600px] overflow-y-auto rounded-lg border border-border bg-card p-4", className)}>
      {/* Legend - Black/white with grayscale colors */}
      <div className="mb-4 flex flex-wrap gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "#1a1a1a" }} />
          <span className="text-xs font-medium">My Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "#525252" }} />
          <span className="text-xs font-medium">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "#a3a3a3" }} />
          <span className="text-xs font-medium">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 border-dashed" style={{ borderColor: "#d4d4d4" }} />
          <span className="text-xs font-medium">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "#fee2e2" }} />
          <span className="text-xs font-medium">Holiday</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "#fef3c7" }} />
          <span className="text-xs font-medium">Weekend</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "#f5f5f5", textDecoration: "line-through" }} />
          <span className="text-xs font-medium" style={{ textDecoration: "line-through", opacity: 0.6 }}>Cancelled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "#fef2f2" }} />
          <span className="text-xs font-medium" style={{ textDecoration: "line-through", opacity: 0.6 }}>No Show</span>
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
        dayPropGetter={dayPropGetter}
        components={components}
        step={30}
        timeslots={2}
        min={new Date(0, 0, 0, 6, 0, 0)} // 6 AM
        max={new Date(0, 0, 0, 22, 0, 0)} // 10 PM
        views={["month", "week", "day", "agenda"]}
        popup
        className="booking-calendar"
        style={{ height: "850px" }}
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
