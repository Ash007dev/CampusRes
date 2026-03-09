"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/api";
import { getISTHour, getCurrentIST, formatDateTimeInIst, formatTimeInIst, utcToIst, utcToIstShifted } from "@/lib/dateUtils";

// Generate time slots from 6 AM to 10 PM
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 22) {
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: (Booking | { id: string; startTime?: string; endTime?: string; start?: Date; end?: Date; room?: any }) | null;
  onReschedule: (bookingId: string, newStartTime: string, newEndTime: string) => Promise<void>;
}

export function RescheduleModal({
  isOpen,
  onClose,
  booking,
  onReschedule,
}: RescheduleModalProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // Initialize form with booking's current date and time
  useEffect(() => {
    if (booking && isOpen) {
      // Handle both Booking (startTime/endTime) and BookingEvent (start/end) types
      const startTimeValue = (booking as any).startTime || (booking as any).start;
      const endTimeValue = (booking as any).endTime || (booking as any).end;

      const bookingStart = utcToIstShifted(startTimeValue);
      const bookingEnd = utcToIstShifted(endTimeValue);

      // Validate dates before formatting
      if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
        console.error('Invalid booking dates:', { startTimeValue, endTimeValue });
        setError("Invalid booking dates");
        return;
      }

      setDate(bookingStart);
      setStartTime(format(bookingStart, "HH:mm"));
      setEndTime(format(bookingEnd, "HH:mm"));
      setError("");
    }
  }, [booking, isOpen]);

  const handleSubmit = async () => {
    if (!booking || !date || !startTime || !endTime) {
      setError("Please fill in all fields");
      return;
    }

    // Validate end time is after start time
    const startMinutes = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);
    const endMinutes = parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]);

    if (endMinutes <= startMinutes) {
      setError("End time must be after start time");
      return;
    }

    // Validate booking is in the future
    const [startHour, startMin] = startTime.split(":").map(Number);
    const bookingStart = new Date(date);
    bookingStart.setHours(startHour, startMin, 0, 0);

    const now = new Date();
    if (bookingStart <= now) {
      setError("Booking must be scheduled for a future time");
      return;
    }

    // Format as ISO string but preserve local time
    const formatLocalAsISO = (dateObj: Date, timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      const hoursStr = String(hours).padStart(2, "0");
      const minutesStr = String(minutes).padStart(2, "0");
      return `${year}-${month}-${day}T${hoursStr}:${minutesStr}:00`;
    };

    const newStartTime = formatLocalAsISO(date, startTime);
    const newEndTime = formatLocalAsISO(date, endTime);

    setIsSubmitting(true);
    setError("");

    try {
      await onReschedule((booking as any).id, newStartTime, newEndTime);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to reschedule booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
          <DialogDescription>
            Change the date and time for your booking of{" "}
            <span className="font-semibold">{booking?.room?.name || (booking as any)?.roomName || "the room"}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select start time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <Label>End Time</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger>
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select end time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
