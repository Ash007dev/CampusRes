"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Edit,
  Trash2,
  Video,
  FileText,
  CreditCard,
  LogOut,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { BookingEvent } from "./BookingCalendar";

interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingEvent | null;
  onEdit?: (booking: BookingEvent) => void;
  onCancel?: (booking: BookingEvent) => void;
  onCheckIn?: (booking: BookingEvent) => void;
  onEarlyCheckout?: (booking: BookingEvent) => void;
}


const STATUS_CONFIG = {
  CONFIRMED: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "bg-foreground",
    textColor: "text-foreground",
    bgColor: "bg-secondary",
  },
  PENDING: {
    label: "Pending Approval",
    icon: AlertCircle,
    color: "bg-muted-foreground",
    textColor: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    color: "bg-muted-foreground",
    textColor: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle,
    color: "bg-muted-foreground",
    textColor: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  CHECKED_IN: {
    label: "Checked In",
    icon: CheckCircle,
    color: "bg-foreground",
    textColor: "text-foreground",
    bgColor: "bg-secondary",
  },
  NO_SHOW: {
    label: "No Show",
    icon: XCircle,
    color: "bg-muted-foreground",
    textColor: "text-muted-foreground",
    bgColor: "bg-muted",
  },
};

export function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
  onEdit,
  onCancel,
  onCheckIn,
  onEarlyCheckout,
}: BookingDetailsModalProps) {
  if (!booking) return null;

  const statusConfig = STATUS_CONFIG[booking.status];
  const StatusIcon = statusConfig.icon;

  const startTime = booking.start as Date;
  const endTime = booking.end as Date;
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
  const isUpcoming = startTime > new Date();
  const isNow = startTime <= new Date() && endTime >= new Date();
  const isCheckedIn = booking.checkInStatus === "CHECKED_IN";

  const userInitials = booking.userName
    ? booking.userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
    : "U";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          {/* Header with status badge */}
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <DialogTitle className="text-2xl font-semibold leading-tight">
                {booking.title || booking.roomName}
              </DialogTitle>
              <Badge
                variant="secondary"
                className={cn(
                  "w-fit",
                  statusConfig.bgColor,
                  statusConfig.textColor
                )}
              >
                <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                {statusConfig.label}
              </Badge>
            </div>
          </div>

          {/* Quick info banner - Teams/Meet style */}
          <div className={cn(
            "rounded-lg p-4 space-y-2 border",
            booking.isOwner ? "bg-foreground text-background border-foreground" : "bg-muted border-border"
          )}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {booking.isOwner ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Your Booking</span>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4" />
                  <span>Booked by {booking.userName || "Another user"}</span>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Main content - Teams/Meet inspired layout */}
        <div className="space-y-6">
          {/* Date & Time Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              When
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border">
                  <Calendar className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {format(startTime, "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")} ({duration}h)
                  </p>
                </div>
              </div>

              {/* Status indicators */}
              {isNow && (
                <div className="flex items-center gap-2 rounded-md bg-foreground text-background px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-background animate-pulse" />
                  <span className="text-sm font-medium">Happening now</span>
                </div>
              )}
              {isUpcoming && booking.status === "CONFIRMED" && (
                <div className="flex items-center gap-2 rounded-md bg-secondary border border-border px-3 py-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Upcoming booking</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Where
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border">
                <MapPin className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="font-medium">{booking.roomName}</p>
                <p className="text-sm text-muted-foreground">Campus Resource</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Organizer/Attendees Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Organized by
            </h3>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-secondary border border-border text-foreground font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{booking.userName || "User"}</p>
                {booking.isOwner && (
                  <p className="text-sm text-muted-foreground">You</p>
                )}
              </div>
            </div>
          </div>

          {/* Purpose/Description */}
          {booking.purpose && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
                  Purpose
                </h3>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border">
                    <FileText className="h-5 w-5 text-foreground" />
                  </div>
                  <p className="flex-1 text-sm leading-relaxed">
                    {booking.purpose}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Additional Info - Teams style */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary border border-border p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Booking ID</span>
            </div>
            <p className="text-sm font-mono">#{booking.id.slice(0, 8)}</p>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Duration</span>
            </div>
            <p className="text-sm">{duration} hours</p>
          </div>
        </div>

        {/* Action buttons - Teams/Meet style footer */}
        {booking.isOwner && booking.status !== "CANCELLED" && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {isNow && onCheckIn && booking.status === "CONFIRMED" && !isCheckedIn && (
                <Button
                  onClick={() => onCheckIn(booking)}
                  className="flex-1 sm:flex-none"
                  size="lg"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Check In Now
                </Button>
              )}
              {isNow && onEarlyCheckout && booking.status === "CONFIRMED" && isCheckedIn && (
                <Button
                  onClick={() => onEarlyCheckout(booking)}
                  variant="secondary"
                  className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white"
                  size="lg"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  End Meeting
                </Button>
              )}
              {isUpcoming && onEdit && booking.status === "CONFIRMED" && (
                <Button
                  onClick={() => onEdit(booking)}
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-none"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Reschedule
                </Button>
              )}
              {onCancel && (booking.status === "CONFIRMED" || booking.status === "PENDING") && (
                <Button
                  onClick={() => onCancel(booking)}
                  variant="destructive"
                  size="lg"
                  className="flex-1 sm:flex-none"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel Booking
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
