"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { format, addHours } from "date-fns";
import { CalendarIcon, Clock, Repeat, AlertCircle, CheckCircle, Loader2, User, Copy, Check, Bell, Volume2, Users2, Lightbulb, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { QRCodeSVG } from "qrcode.react";
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
import { type Room } from "@/components/room/RoomCard";
import { type ApiError, waitlistApi, bookingsApi, type BalancedRoomResult } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { getISTHour, getCurrentIST } from "@/lib/dateUtils";

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
// Uses Fake UTC (IST) for consistent client-side defaults
const getNextAvailableTime = () => {
  // getCurrentIST() returns a Date object where .getHours() (in UTC env) or .getUTCHours() 
  // is the IST hour.
  // Since we are in a "Fake UTC" strategy, we can treating the Date object as if it is local.
  // BUT: The browser will interpret new Date() as local. 
  // getCurrentIST() returns a shifted date. 
  // If real time is 9 AM IST. getCurrentIST() returns 2:30 PM (Fake).
  // NO. getCurrentIST() returns real time + 5.5h.

  // Let's stick to simple: use system time and shift if needed or just use consistent utils.
  // Actually, for the simplified "Fake UTC" strategy, the frontend keeps things simple:
  // We want the default time to be "Next Hour" in IST.

  const now = getCurrentIST();
  // now is a Date object representing IST.
  // If it's 9:00 IST, now (as ISO) says ...09:00Z.
  // So .getUTCHours() is 9.

  const currentHour = now.getUTCHours();

  const nextHour = currentHour + 1;
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
  eventNoiseLevel: z.enum(["QUIET", "MODERATE", "LOUD"]).default("MODERATE"),
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
    const now = getCurrentIST();
    const [startHour, startMin] = data.startTime.split(":").map(Number);
    const bookingStart = new Date(Date.UTC(
      data.date.getFullYear(),
      data.date.getMonth(),
      data.date.getDate(),
      startHour,
      startMin,
      0,
      0
    ));
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
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Array<Record<string, any>>>([]);
  const [isBookingConflict, setIsBookingConflict] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [hasJoinedWaitlist, setHasJoinedWaitlist] = useState(false);
  // US 7 – Smart Room Suggestion
  const [attendeeCount, setAttendeeCount] = useState<string>('');
  const [recommendedRooms, setRecommendedRooms] = useState<any[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  // US 8 – Load Balanced Room suggestion
  const [balancedSuggestion, setBalancedSuggestion] = useState<BalancedRoomResult | null>(null);
  const { toast } = useToast();

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
    getValues,
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
          const now = getCurrentIST();
          const [startHour, startMin] = data.startTime.split(":").map(Number);
          const bookingStart = new Date(Date.UTC(
            data.date.getFullYear(),
            data.date.getMonth(),
            data.date.getDate(),
            startHour,
            startMin,
            0,
            0
          ));
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
      eventNoiseLevel: "MODERATE",
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
      setIsBookingConflict(false);
      setAlternatives([]);

      try {
        const result = await onSubmit(data); // data already includes roomId
        setSuccessStatus(result?.data?.status || "CONFIRMED");
        setConfirmedBooking(result?.data || null);
        setIsSuccess(true);
        setIsSubmitting(false);
      } catch (err: any) {
        console.error('[BookingModal] Booking submission failed', err);
        let errorMessage = 'Failed to create booking. Please try again.';
        let isConflict = false;

        // Handle ApiError with structured details
        if (err.name === 'ApiError') {
          const apiError = err as ApiError;

          // Check for alternatives in details (BookingConflictError)
          if (apiError.details?.alternatives && Array.isArray(apiError.details.alternatives)) {
            // Server may return {start, end} or {startTime, endTime} — normalize
            setAlternatives(apiError.details.alternatives);
            errorMessage = apiError.message || "This time slot is unavailable. Here are some alternatives:";
            isConflict = true;
          }
          // Check if error message indicates a conflict
          else if (apiError.message && (
            apiError.message.toLowerCase().includes('conflict') ||
            apiError.message.toLowerCase().includes('already booked') ||
            apiError.message.toLowerCase().includes('not available')
          )) {
            errorMessage = apiError.message;
            isConflict = true;
          }
          // Check for other details
          else if (apiError.message) {
            errorMessage = apiError.message;
          }
        }
        // Fallback for standard Error 
        else if (err instanceof Error) {
          errorMessage = err.message;
          // Check for conflict keywords in standard error messages too
          if (errorMessage.toLowerCase().includes('conflict') ||
            errorMessage.toLowerCase().includes('already booked') ||
            errorMessage.toLowerCase().includes('not available')) {
            isConflict = true;
          }
        }
        // Fallback for string
        else if (typeof err === 'string') {
          errorMessage = err;
        }

        // Avoid [object Object] at all costs
        if (typeof errorMessage === 'object') {
          console.error('[BookingModal] Error message is an object:', errorMessage);
          errorMessage = JSON.stringify(errorMessage);
        }

        setError(errorMessage);
        setIsBookingConflict(isConflict);
        setIsSubmitting(false);
      }
    },
    [onSubmit]
  );

  // Handle selecting an alternative slot
  const handleSelectAlternative = useCallback((slot: Record<string, any>) => {
    // Server may return {start, end} or {startTime, endTime} — handle both
    const startRaw = slot.startTime || slot.start;
    const endRaw = slot.endTime || slot.end;
    const start = new Date(startRaw);
    const end = new Date(endRaw);

    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      setValue("startTime", format(start, "HH:mm"));
      setValue("endTime", format(end, "HH:mm"));
    }

    // Clear error and alternatives
    setError(null);
    setAlternatives([]);
    setIsBookingConflict(false);
  }, [setValue]);

  // Handle joining waitlist when slot is occupied
  const handleJoinWaitlist = useCallback(async () => {
    if (!watchRoomId || !watchDate) {
      toast({
        title: "Missing Information",
        description: "Please select a room and date first.",
        variant: "destructive",
      });
      return;
    }

    setIsJoiningWaitlist(true);
    try {
      const dateObj = new Date(watchDate);
      const [startHour, startMin] = watch("startTime").split(":").map(Number);
      const [endHour, endMin] = watch("endTime").split(":").map(Number);

      const startDateTime = new Date(dateObj);
      startDateTime.setHours(startHour, startMin, 0, 0);

      const endDateTime = new Date(dateObj);
      endDateTime.setHours(endHour, endMin, 0, 0);

      const response = await waitlistApi.join(
        watchRoomId,
        startDateTime.toISOString(),
        endDateTime.toISOString()
      );

      setHasJoinedWaitlist(true);
      setError(null);
      setIsBookingConflict(false);

      toast({
        title: "Added to Waitlist ✓",
        description: `You're #${response.data.data?.position || 1} in line. We'll notify you when this slot becomes available!`,
      });

      // Close modal after a brief delay
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      toast({
        title: "Waitlist Failed",
        description: err.message || "Unable to join waitlist. You may already be on it.",
        variant: "destructive",
      });
    } finally {
      setIsJoiningWaitlist(false);
    }
  }, [watchRoomId, watchDate, watch, toast]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      reset();
      setError(null);
      setIsSuccess(false);
      setConfirmedBooking(null);
      setCopiedId(false);
      setAlternatives([]);
      setIsBookingConflict(false);
      setHasJoinedWaitlist(false);
      setIsJoiningWaitlist(false);
      setRecommendedRooms([]);
      setShowRecommendations(false);
      setAttendeeCount('');
      setBalancedSuggestion(null);
      onClose();
    }
  }, [reset, onClose, isSubmitting]);

  // US 7 – Fetch smart room recommendation
  const handleFindBestRoom = useCallback(async () => {
    // Use getValues() (not watch()) to read current form values without stale closure
    const { startTime, endTime, date } = getValues();
    if (!attendeeCount || !startTime || !endTime || !date) {
      toast({ title: 'Missing fields', description: 'Please select a date and time range first.', variant: 'destructive' });
      return;
    }
    setIsRecommending(true);
    setShowRecommendations(false);
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const startISO = `${dateStr}T${startTime}:00`;
      const endISO = `${dateStr}T${endTime}:00`;
      const res = await bookingsApi.recommendRoom(Number(attendeeCount), startISO, endISO);
      // API returns { recommendations: [...], criteria: {...} }
      const raw = res.data.data as any;
      const roomsList = Array.isArray(raw) ? raw : (raw?.recommendations || raw?.rooms || []);
      setRecommendedRooms(roomsList);
      setShowRecommendations(true);
    } catch (err: any) {
      toast({ title: 'Recommendation failed', description: err.message || 'Could not fetch suggestions.', variant: 'destructive' });
    } finally {
      setIsRecommending(false);
    }
  }, [attendeeCount, getValues, toast]);

  // US 8 – Check load-balanced alternative when room + times change
  const watchStartTimeVal = watch('startTime');
  const watchEndTimeVal = watch('endTime');
  const watchDateVal = watch('date');
  React.useEffect(() => {
    const currentRoomId = watchRoomId;
    if (!currentRoomId || !watchStartTimeVal || !watchEndTimeVal || !watchDateVal) {
      setBalancedSuggestion(null);
      return;
    }
    const dateStr = watchDateVal.toISOString ? watchDateVal.toISOString().split('T')[0] : '';
    if (!dateStr) return;
    const startISO = `${dateStr}T${watchStartTimeVal}:00`;
    const endISO = `${dateStr}T${watchEndTimeVal}:00`;
    bookingsApi.getBalancedRoom(currentRoomId, startISO, endISO, attendeeCount ? Number(attendeeCount) : undefined)
      .then(res => {
        const result = res.data.data as BalancedRoomResult;
        // Only show if a different room is suggested
        if (result?.suggestedRoom && result.suggestedRoom.id !== currentRoomId) {
          setBalancedSuggestion(result);
        } else {
          setBalancedSuggestion(null);
        }
      })
      .catch(() => setBalancedSuggestion(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchRoomId, watchStartTimeVal, watchEndTimeVal, watchDateVal]);

  // Handle copy booking ID
  const handleCopyId = useCallback(() => {
    if (confirmedBooking?.id) {
      const idText = confirmedBooking.id;
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(idText);
        } else {
          // Fallback for HTTP localhost
          const textArea = document.createElement('textarea');
          textArea.value = idText;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } catch (err) {
        console.error('Failed to copy booking ID:', err);
        // Still show feedback even if copy fails
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
    }
  }, [confirmedBooking]);


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
          {/* Success / Booking Confirmation Overlay (US 4) */}
          {isSuccess && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg p-6">
              <div className="animate-bounce mb-2">
                {successStatus === "PENDING_APPROVAL" ? (
                  <Clock className="w-14 h-14 text-blue-500" />
                ) : (
                  <CheckCircle className="w-14 h-14 text-green-500" />
                )}
              </div>
              <h3 className={`text-xl font-bold mt-2 ${successStatus === "PENDING_APPROVAL" ? "text-blue-600" : "text-green-600"}`}>
                {successStatus === "PENDING_APPROVAL" ? "Request Submitted!" : "Booking Confirmed!"}
              </h3>
              <p className="text-muted-foreground mt-1 text-center text-sm px-4">
                {successStatus === "PENDING_APPROVAL"
                  ? "This room requires admin approval. You will be notified once it is reviewed."
                  : "Your booking has been successfully created."}
              </p>

              {/* Booking ID */}
              {confirmedBooking?.id && (
                <div className="mt-4 flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                  <span className="text-sm font-mono font-semibold">
                    BK-{confirmedBooking.id.slice(0, 8).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy Booking ID"
                  >
                    {copiedId ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}

              {/* QR Code for Check-in */}
              {confirmedBooking && successStatus !== "PENDING_APPROVAL" && (
                <div className="mt-4 p-3 bg-white rounded-lg shadow-sm border">
                  <QRCodeSVG
                    value={confirmedBooking.room?.code || confirmedBooking.roomId || confirmedBooking.id}
                    size={120}
                    level="M"
                  />
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Scan to check in
                  </p>
                </div>
              )}

              <Button
                className="mt-4"
                onClick={handleClose}
              >
                Done
              </Button>
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
            <div className="flex flex-col gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-semibold">{error}</span>
              </div>

              {/* Suggested Alternatives */}
              {alternatives.length > 0 && (
                <div className="mt-2 pl-6">
                  <p className="mb-2 text-xs font-medium text-destructive/80">
                    Suggested available slots:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {alternatives.slice(0, 3).map((slot, index) => {
                      let start: Date;
                      let end: Date;

                      try {
                        // Server may return {start, end} or {startTime, endTime}
                        const startRaw = slot.startTime || slot.start;
                        const endRaw = slot.endTime || slot.end;
                        start = new Date(startRaw);
                        end = new Date(endRaw);

                        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                          return null;
                        }
                      } catch (e) {
                        return null;
                      }

                      const label = `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;

                      return (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          type="button"
                          className="h-7 border-destructive/30 bg-background text-xs hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleSelectAlternative(slot)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Join Waitlist Button - shown when booking conflict detected */}
              {isBookingConflict && !hasJoinedWaitlist && (
                <div className="mt-3 pt-3 border-t border-destructive/20">
                  <p className="mb-2 text-xs font-medium text-destructive/80">
                    Or join the waitlist to be notified when this slot becomes available:
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-blue-500/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    onClick={handleJoinWaitlist}
                    disabled={isJoiningWaitlist}
                  >
                    {isJoiningWaitlist ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Joining Waitlist...
                      </>
                    ) : (
                      <>
                        <Bell className="mr-2 h-4 w-4" />
                        Join Waitlist
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Room Selection (only if not pre-selected) */}
          <div className="space-y-2">
            <Label>Room *</Label>
            <Select
              value={watchRoomId}
              onValueChange={(val) => {
                setValue("roomId", val);
                setBalancedSuggestion(null); // reset on manual change
                setShowRecommendations(false);
              }}
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

          {/* US 7 – Smart Room Suggestion (only when no room pre-selected) */}
          {!room && (
            <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900/50 p-3">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-medium">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Smart Room Suggestion (US 7)</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Users2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="number"
                    min="1"
                    placeholder="Number of attendees"
                    value={attendeeCount}
                    onChange={(e) => setAttendeeCount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-blue-400 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  onClick={handleFindBestRoom}
                  disabled={!attendeeCount || isRecommending}
                >
                  {isRecommending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {showRecommendations && recommendedRooms.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Best fit rooms — click to select:</p>
                  <div className="flex flex-wrap gap-2">
                    {recommendedRooms.slice(0, 4).map((r: any) => (
                      <button
                        key={r.roomId || r.id}
                        type="button"
                        onClick={() => {
                          setValue('roomId', r.roomId || r.id);
                          setShowRecommendations(false);
                        }}
                        className="px-2.5 py-1 rounded-full text-xs border bg-background hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 transition-colors"
                      >
                        {r.roomName || r.name} ({r.capacity}p)
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showRecommendations && recommendedRooms.length === 0 && (
                <p className="text-xs text-muted-foreground">No suitable rooms found for that group size.</p>
              )}
            </div>
          )}

          {/* US 8 – Load Balanced Room advisory */}
          {balancedSuggestion?.suggestedRoom && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 p-3 text-sm">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-amber-800 dark:text-amber-400">Load Balance Tip (US 8)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <strong>{balancedSuggestion.suggestedRoom.name}</strong> is an equivalent room that&apos;s currently less busy.
                  {balancedSuggestion.reason && ` ${balancedSuggestion.reason}`}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-shrink-0 border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 h-7 text-xs"
                onClick={() => {
                  setValue('roomId', balancedSuggestion!.suggestedRoom!.id);
                  setBalancedSuggestion(null);
                }}
              >
                Use This Room
              </Button>
            </div>
          )}

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

          {/* Noise Level */}
          <div className="space-y-2">
            <Label>Event Noise Level *</Label>
            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
              <Volume2 className="h-3 w-3" />
              <span>We use this to prevent noisy and quiet events from being adjacent.</span>
            </div>
            <Select
              defaultValue={watch("eventNoiseLevel")}
              onValueChange={(val) => setValue("eventNoiseLevel", val as "QUIET" | "MODERATE" | "LOUD")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select noise level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QUIET">Quiet (e.g., Exam, Silent Study)</SelectItem>
                <SelectItem value="MODERATE">Moderate (e.g., Lecture, Meeting)</SelectItem>
                <SelectItem value="LOUD">Loud (e.g., Presentation with audio, Event)</SelectItem>
              </SelectContent>
            </Select>
            {errors.eventNoiseLevel && (
              <p className="text-sm text-destructive">
                {(errors.eventNoiseLevel as any).message}
              </p>
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
