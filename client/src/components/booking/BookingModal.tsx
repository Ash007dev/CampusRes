"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { CalendarIcon, Clock, Repeat, AlertCircle, CheckCircle, Loader2, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Room } from "@/components/room/RoomCard";

// Validation schema
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

// Get next available time slot (at least 1 hour from now)
const getNextAvailableTime = () => {
  const now = new Date();
  const nextHour = now.getHours() + 1;
  // If it's past 9PM, default to next day 9AM
  if (nextHour >= 22) {
    return { hour: 9, date: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
  }
  // Otherwise use next hour, minimum 9AM
  const hour = Math.max(9, nextHour);
  return { hour, date: now };
};

// Base schema for validation
const baseBookingSchema = z.object({
  purpose: z.string().min(5, "Purpose must be at least 5 characters"),
  date: z.date({ required_error: "Please select a date" }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.enum(["DAILY", "WEEKLY", "BIWEEKLY"]).optional(),
  recurringEndDate: z.date().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
});

// Final schema with refinements
const bookingSchema = baseBookingSchema.refine(
  (data) => {
    const start = parseInt(data.startTime.replace(":", ""));
    const end = parseInt(data.endTime.replace(":", ""));
    return end > start;
  },
  { message: "End time must be after start time", path: ["endTime"] }
).refine(
  (data) => {
    // Check if booking is in the future
    const now = new Date();
    const [startHour, startMin] = data.startTime.split(":").map(Number);
    const bookingStart = new Date(data.date);
    bookingStart.setHours(startHour, startMin, 0, 0);
    return bookingStart > now;
  },
  { message: "Booking must be scheduled for a future time", path: ["startTime"] }
);

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room?: Room | null;
  rooms?: Room[];
  onSubmit: (data: BookingFormData & { roomId: string }) => Promise<any>;
  selectedDate?: Date;
  selectedStartTime?: Date;
  isAdmin?: boolean;
}

export function BookingModal({
  isOpen,
  onClose,
  room,
  rooms = [],
  onSubmit,
  selectedDate,
  selectedStartTime,
  isAdmin = false,
}: BookingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successStatus, setSuccessStatus] = useState<string>("CONFIRMED");
  const [error, setError] = useState<string | null>(null);

  // Get default future time
  const defaultTime = getNextAvailableTime();
  const defaultDate = selectedDate || defaultTime.date;
  const defaultStartHour = selectedStartTime
    ? format(selectedStartTime, "HH:mm")
    : `${defaultTime.hour.toString().padStart(2, "0")}:00`;
  const defaultEndHour = selectedStartTime
    ? format(addHours(selectedStartTime, 1), "HH:mm")
    : `${(defaultTime.hour + 1).toString().padStart(2, "0")}:00`;

  // Initialize form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BookingFormData & { roomId: string }>({
    resolver: zodResolver(
      baseBookingSchema.extend({
        roomId: z.string().min(1, "Please select a room"),
      }).refine(
        (data) => {
          const start = parseInt(data.startTime.replace(":", ""));
          const end = parseInt(data.endTime.replace(":", ""));
          return end > start;
        },
        { message: "End time must be after start time", path: ["endTime"] }
      ).refine(
        (data) => {
          // Check if booking is in the future
          const now = new Date();
          const [startHour, startMin] = data.startTime.split(":").map(Number);
          const bookingStart = new Date(data.date);
          bookingStart.setHours(startHour, startMin, 0, 0);
          return bookingStart > now;
        },
        { message: "Booking must be scheduled for a future time", path: ["startTime"] }
      )
    ),
    defaultValues: {
      roomId: room?.id || "",
      purpose: "",
      date: defaultDate,
      startTime: defaultStartHour,
      endTime: defaultEndHour,
      isRecurring: false,
      guestName: "",
      guestPhone: "",
    },
  });

  // Update roomId when pre-selected room changes
  React.useEffect(() => {
    if (room) {
      setValue("roomId", room.id);
    }
  }, [room, setValue]);

  const watchDate = watch("date");
  const watchRoomId = watch("roomId");
  const watchIsRecurring = watch("isRecurring");
  const selectedRoom = room || rooms.find(r => r.id === watchRoomId);

  // Handle form submission
  const onFormSubmit = useCallback(
    async (data: BookingFormData & { roomId: string }) => {
      setIsSubmitting(true);
      setError(null);
      setIsSuccess(false);

      try {
        const result = await onSubmit(data); // data already includes roomId
        setSuccessStatus(result?.data?.status || "CONFIRMED");
        setIsSuccess(true);
        setIsSubmitting(false);
        // Show success animation then close
        setTimeout(() => {
          reset();
          setIsSuccess(false);
          setError(null);
          onClose();
        }, 3000); // 3 seconds to read the approval message
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create booking"
        );
        setIsSubmitting(false);
      }
    },
    [onSubmit, reset, onClose]
  );

  // Handle modal close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      reset();
      setError(null);
      onClose();
    }
  }, [reset, onClose, isSubmitting]);


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {room ? `Book ${room.name}` : "Book a Room"}
          </DialogTitle>
          <DialogDescription>
            {selectedRoom
              ? `${selectedRoom.building}, Floor ${selectedRoom.floor} • Capacity: ${selectedRoom.capacity}`
              : "Select a room and time for your booking"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Success Animation Overlay */}
          {isSuccess && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
              <div className="animate-bounce">
                {successStatus === "PENDING_APPROVAL" ? (
                  <Clock className="w-20 h-20 text-blue-500" />
                ) : (
                  <CheckCircle className="w-20 h-20 text-green-500" />
                )}
              </div>
              <h3 className={`text-xl font-bold mt-4 ${successStatus === "PENDING_APPROVAL" ? "text-blue-600" : "text-green-600"}`}>
                {successStatus === "PENDING_APPROVAL" ? "Request Submitted!" : "Booking Confirmed!"}
              </h3>
              <p className="text-muted-foreground mt-2 text-center px-6">
                {successStatus === "PENDING_APPROVAL"
                  ? "This room requires admin approval. You will be notified once it is reviewed."
                  : "Your booking has been successfully created."}
              </p>
            </div>
          )}

          {/* Loading Overlay */}
          {isSubmitting && !isSuccess && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground mt-4">Creating your booking...</p>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Room Selection (only if not pre-selected) */}
          <div className="space-y-2">
            <Label>Room *</Label>
            <Select
              value={watchRoomId}
              onValueChange={(val) => setValue("roomId", val)}
              disabled={!!room} // Disable if room is pre-selected
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.capacity} ppl)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roomId && (
              <p className="text-sm text-destructive">
                {(errors.roomId as any).message}
              </p>
            )}
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose *</Label>
            <Input
              id="purpose"
              placeholder="e.g., Team Meeting, Lab Session"
              {...register("purpose")}
            />
            {errors.purpose && (
              <p className="text-sm text-destructive">{errors.purpose.message}</p>
            )}
          </div>

          {/* Admin: Guest Booking Details */}
          {isAdmin && (
            <div className="space-y-4 rounded-md border border-orange-200 bg-orange-50/50 p-4 dark:bg-orange-950/20 dark:border-orange-900/50">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <User className="h-4 w-4" />
                <Label className="text-orange-600 dark:text-orange-400 font-semibold">Guest Booking (Optional)</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guestName">Guest Name</Label>
                  <Input
                    id="guestName"
                    placeholder="External Guest Name"
                    {...register("guestName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestPhone">Guest Phone</Label>
                  <Input
                    id="guestPhone"
                    placeholder="+91 99999 99999"
                    {...register("guestPhone")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !watchDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {watchDate ? format(watchDate, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={watchDate}
                  onSelect={(date) => date && setValue("date", date)}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    return date < today
                  }}
                  defaultMonth={new Date()}
                  fromDate={new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Select
                defaultValue={watch("startTime")}
                onValueChange={(value) => setValue("startTime", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((time) => (
                    <SelectItem key={`start-${time}`} value={time}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {time}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.startTime && (
                <p className="text-sm text-destructive">
                  {errors.startTime.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>End Time *</Label>
              <Select
                defaultValue={watch("endTime")}
                onValueChange={(value) => setValue("endTime", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((time) => (
                    <SelectItem key={`end-${time}`} value={time}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {time}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.endTime && (
                <p className="text-sm text-destructive">
                  {errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          {/* Recurring Booking */}
          <div className="space-y-4 rounded-md border p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurring"
                checked={watchIsRecurring}
                onCheckedChange={(checked) =>
                  setValue("isRecurring", checked as boolean)
                }
              />
              <Label htmlFor="isRecurring" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Recurring Booking
              </Label>
            </div>

            {watchIsRecurring && (
              <>
                <div className="space-y-2">
                  <Label>Repeat Pattern</Label>
                  <Select
                    onValueChange={(value) =>
                      setValue(
                        "recurringPattern",
                        value as "DAILY" | "WEEKLY" | "BIWEEKLY"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pattern" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watch("recurringEndDate")
                          ? format(watch("recurringEndDate")!, "PPP")
                          : "Select end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={watch("recurringEndDate")}
                        onSelect={(date) =>
                          date && setValue("recurringEndDate", date)
                        }
                        disabled={(date) => date <= (watchDate || new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { BookingModalProps, BookingFormData };
