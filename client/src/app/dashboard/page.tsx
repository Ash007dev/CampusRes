"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useBookingReminders } from "@/hooks/useBookingReminders";
import { useBookingUpdates, type BookingUpdate } from "@/hooks/useSocket";
import {
  Calendar,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookingCalendar,
  type BookingEvent,
} from "@/components/booking/BookingCalendar";
import { BookingModal, type BookingFormData } from "@/components/booking/BookingModal";
import { BookingDetailsModal } from "@/components/booking/BookingDetailsModal";
import { RescheduleModal } from "@/components/booking/RescheduleModal";
import { FairnessPolicyModal } from "@/components/ui/fairness-policy-modal";
import { RoomFilter, useRoomFilters, type RoomFilters } from "@/components/room/RoomFilter";
import { RoomCard, type Room } from "@/components/room/RoomCard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { roomsApi, bookingsApi, authApi, waitlistApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SlotInfo } from "react-big-calendar";

// Types
interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

type ViewMode = "calendar" | "grid" | "list";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<BookingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingEvent | null>(null);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [bookingToReschedule, setBookingToReschedule] = useState<BookingEvent | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date;
    startTime: Date;
  } | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ usedHours: number; limitHours: number } | null>(null);
  const [notifyingRoomId, setNotifyingRoomId] = useState<string | null>(null);
  const { toast } = useToast();

  const { filters, setFilters } = useRoomFilters();

  // US 3.8: Check-in reminders (5 min before booking)
  useBookingReminders();

  // Get user with localStorage fallback for immediate display
  // Use useState + useEffect to avoid hydration mismatch (SSR vs client)
  const [displayUser, setDisplayUser] = React.useState<typeof user>(null);
  const [userLoadError, setUserLoadError] = React.useState<string | null>(null);

  // Load from localStorage immediately on mount (client-side only)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('user');
        // Debug log removed

        if (stored) {
          const parsedUser = JSON.parse(stored);
          // Debug log removed

          // Validate that user object has required fields
          if (parsedUser && parsedUser.id && parsedUser.email) {
            // Ensure name field exists, construct from firstName/lastName if needed
            if (!parsedUser.name && parsedUser.firstName && parsedUser.lastName) {
              parsedUser.name = `${parsedUser.firstName} ${parsedUser.lastName}`;
              // Debug log removed
            }
            setDisplayUser(parsedUser);
          } else {
            // Warning removed
            setUserLoadError("Invalid user data");
          }
        } else {
          // Debug log removed
        }
      } catch (error) {
        console.error("[Dashboard] Failed to parse stored user:", error);
        setUserLoadError("Failed to load user data");
      }
    }
  }, []); // Run once on mount

  // Update when auth context provides user
  React.useEffect(() => {
    if (user) {
      // Debug log removed
      setDisplayUser(user);
      setUserLoadError(null);
    }
  }, [user]);

  // Get the current user to display (prefer auth context, fallback to displayUser)
  const currentUser = user || displayUser;

  // Debug logging
  React.useEffect(() => {
    // Debug log removed
    // Debug log removed
    // Debug log removed
  }, [user, displayUser, currentUser, userLoadError]);

  // Fetch rooms and bookings
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [availableNowResponse, bookingsResponse, quotaResponse] = await Promise.all([
        roomsApi.getAvailableNow(), // US 3.3: Fetch rooms with real-time availability
        bookingsApi.getCalendarBookings(), // Fetch ALL bookings for calendar (not just user's)
        authApi.getQuota().catch(() => null), // Optional - may fail for non-students
      ]);
      const roomsData = availableNowResponse.data.data || [];
      const bookingsData = bookingsResponse.data.data || [];

      // Transform rooms data with real-time availability status
      setRooms(
        roomsData.map((room: any) => ({
          id: room.id,
          name: room.name,
          type: room.roomType || room.type,
          capacity: room.capacity,
          location: room.location,
          floor: room.floor?.toString() || "1",
          building: room.building || "Main Building",
          amenities: room.amenities || [],
          imageUrl: room.imageUrl,
          // US 3.3: Use server-computed availability status
          isAvailable: room.availabilityStatus === 'AVAILABLE',
          availabilityStatus: room.availabilityStatus,
          nextBookingInHours: room.nextBookingInHours,
          departmentId: room.departmentId,
          departmentName: room.departments?.name,
        }))
      );

      // Transform bookings to calendar events
      const userId = user?.id;
      setBookings(
        bookingsData.map((booking: any) => ({
          id: booking.id,
          title: booking.title || booking.description || "Booking",
          start: new Date(booking.startTime),
          end: new Date(booking.endTime),
          roomId: booking.roomId,
          roomName: booking.room?.name || booking.rooms?.name || "Room",
          status: booking.status,
          checkInStatus: booking.checkInStatus,
          isOwner: booking.userId === userId,
          userId: booking.userId,
          userName: booking.user?.firstName ? `${booking.user.firstName} ${booking.user.lastName}` : booking.user?.name,
          purpose: booking.title || booking.description,
        }))
      );

      // Set quota info if available
      if (quotaResponse?.data?.data) {
        setQuotaInfo(quotaResponse.data.data as any);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // US 3.3: Live occupancy - listen for real-time booking updates via WebSocket
  const handleBookingUpdate = useCallback((update: BookingUpdate) => {
    // Live update received
    // Refresh data when any booking changes (create, cancel, check-in, ghost-kill)
    fetchData();
  }, [fetchData]);

  useBookingUpdates(handleBookingUpdate);

  useEffect(() => {
    // Only fetch data if we have an access token
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [fetchData]);

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // Handle slot selection in calendar
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    setSelectedSlot({
      date: slotInfo.start,
      startTime: slotInfo.start,
    });
    // Open room selection or booking modal
    setIsBookingModalOpen(true);
  };

  // Handle event selection
  const handleSelectEvent = (event: BookingEvent) => {
    // Show booking details modal
    setSelectedBooking(event);
    setIsDetailsModalOpen(true);
  };

  // Handle edit from details modal
  const handleEditBooking = (booking: BookingEvent) => {
    setIsDetailsModalOpen(false);
    // Open reschedule modal
    setBookingToReschedule(booking);
    setIsRescheduleModalOpen(true);
  };

  // Handle reschedule
  const handleReschedule = async (bookingId: string, newStartTime: string, newEndTime: string) => {
    try {
      await bookingsApi.reschedule(bookingId, newStartTime, newEndTime);
      toast({
        title: "Booking Rescheduled ✓",
        description: "Your booking has been rescheduled successfully.",
      });
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Reschedule Failed",
        description: error.message || "Unable to reschedule booking. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle cancel from details modal
  const handleCancelBooking = async (booking: BookingEvent) => {
    try {
      await bookingsApi.cancel(booking.id);
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully.",
      });
      setIsDetailsModalOpen(false);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel booking.",
        variant: "destructive",
      });
    }
  };

  // Handle check-in from details modal
  const handleCheckInFromDetails = (booking: BookingEvent) => {
    setIsDetailsModalOpen(false);
    // Navigate to bookings page for check-in
    router.push(`/bookings`);
  };

  // Handle early checkout / end meeting (US 3.4)
  const handleEarlyCheckout = async (booking: BookingEvent) => {
    try {
      const response = await bookingsApi.earlyCheckout(booking.id);
      const refundedCredits = (response.data.data as any)?.refundedCredits || 0;

      toast({
        title: "Meeting Ended ✓",
        description: refundedCredits > 0
          ? `Successfully ended. ${refundedCredits} credits refunded to your account.`
          : "Successfully ended your meeting. Room is now available.",
      });
      setIsDetailsModalOpen(false);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "End Meeting Failed",
        description: error.message || "Unable to end meeting. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle booking a room
  const handleBookRoom = (room: Room) => {
    setSelectedRoom(room);
    setIsBookingModalOpen(true);
  };

  // Handle joining waitlist for occupied room (US 3.7)
  const handleNotifyMe = async (room: Room) => {
    setNotifyingRoomId(room.id);
    try {
      // Join waitlist for the next hour slot
      const now = new Date();
      const startTime = new Date(now);
      startTime.setMinutes(0, 0, 0); // Round to hour
      startTime.setHours(startTime.getHours() + 1); // Next hour

      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1); // 1 hour slot

      const response = await waitlistApi.join(
        room.id,
        startTime.toISOString(),
        endTime.toISOString()
      );

      toast({
        title: "Added to Waitlist \u2713",
        description: `You're #${response.data.data?.position || 1} in line for ${room.name}. We'll notify you when it's free!`,
      });
    } catch (error: any) {
      toast({
        title: "Waitlist Failed",
        description: error.message || "Unable to join waitlist. You may already be on it.",
        variant: "destructive",
      });
    } finally {
      setNotifyingRoomId(null);
    }
  };

  // Handle booking submission
  const handleBookingSubmit = async (
    data: BookingFormData & { roomId: string }
  ) => {
    // Parse the date and time components
    const dateObj = new Date(data.date);
    const [startHour, startMin] = data.startTime.split(":").map(Number);
    const [endHour, endMin] = data.endTime.split(":").map(Number);

    // Create date-time by setting hours on the date object
    const startDateTime = new Date(dateObj);
    startDateTime.setHours(startHour, startMin, 0, 0);

    const endDateTime = new Date(dateObj);
    endDateTime.setHours(endHour, endMin, 0, 0);

    // Format as ISO string but remove the timezone offset to store as local time
    // This ensures the time displayed matches the time selected
    const formatLocalAsISO = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    try {
      const response = await bookingsApi.create({
        roomId: data.roomId,
        startTime: formatLocalAsISO(startDateTime),
        endTime: formatLocalAsISO(endDateTime),
        title: data.purpose, // Map purpose to title for API
        description: data.purpose,
      });

      // Refresh data after booking
      await fetchData();
      return response.data; // Return the data
    } catch (error) {
      // Re-throw so BookingModal can handle the error
      throw error;
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
  };

  // Filter rooms based on filter criteria
  const filteredRooms = React.useMemo(() => {
    return rooms.filter((room) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !room.name.toLowerCase().includes(searchLower) &&
          !room.building.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      if (filters.type && room.type !== filters.type) return false;
      if (filters.department && room.departmentId !== filters.department)
        return false;
      if (
        room.capacity < filters.capacity[0] ||
        room.capacity > filters.capacity[1]
      )
        return false;
      if (filters.building && room.building !== filters.building) return false;
      if (filters.floor && room.floor !== filters.floor) return false;
      if (filters.availableNow && !room.isAvailable) return false;
      if (filters.amenities.length > 0) {
        const roomAmenities = Array.isArray(room.amenities)
          ? room.amenities
          : room.amenities && typeof room.amenities === 'object'
            ? Object.keys(room.amenities).filter(k => room.amenities[k])
            : [];
        // Normalize to lowercase for case-insensitive comparison
        const normalizedRoomAmenities = roomAmenities.map(a => a.toLowerCase());
        const normalizedFilterAmenities = filters.amenities.map(a => a.toLowerCase());
        if (!normalizedFilterAmenities.every((a) => normalizedRoomAmenities.includes(a))) return false;
      }
      return true;
    });
  }, [rooms, filters]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">CampusRes</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("h-5 w-5", isRefreshing && "animate-spin")}
              />
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                3
              </span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser?.avatarUrl} />
                    <AvatarFallback>
                      {currentUser?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{currentUser?.name || "User"}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{currentUser?.name || "My Account"}</span>
                    {currentUser?.role && (
                      <span className="text-xs font-normal text-muted-foreground capitalize">
                        {currentUser.role.toLowerCase().replace("_", " ")}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/profile" onClick={(e) => { e.preventDefault(); router.push("/profile"); }}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/bookings" onClick={(e) => { e.preventDefault(); router.push("/bookings"); }}>
                    <Calendar className="mr-2 h-4 w-4" />
                    My Bookings
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/settings" onClick={(e) => { e.preventDefault(); router.push("/settings"); }}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </a>
                </DropdownMenuItem>
                {/* Admin Panel - Only visible for ADMIN users */}
                {currentUser?.role === "ADMIN" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/admin" onClick={(e) => { e.preventDefault(); router.push("/admin"); }}>
                        <Settings className="mr-2 h-4 w-4" />
                        Admin Panel
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Role-based Welcome Banner - Clean Design */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Welcome back, {currentUser?.name?.split(" ")[0] || "User"}!
                </h2>
                <p className="text-muted-foreground mt-1">
                  {currentUser?.role === "ADMIN" && "You have full admin access to manage the campus resources."}
                  {currentUser?.role === "FACULTY" && "You have unlimited booking access for your classes and meetings."}
                  {currentUser?.role === "STUDENT" && "Book rooms for study sessions, group projects, and club meetings."}
                  {currentUser?.role === "LAB_ADMIN" && "Manage bookings and approve requests for your assigned labs."}
                  {!currentUser?.role && "Ready to book a room for your next session?"}
                </p>
              </div>

              {/* Quick Stats based on role */}
              <div className="flex flex-wrap gap-3">
                {/* Student Quota */}
                {currentUser?.role === "STUDENT" && quotaInfo && (
                  <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-secondary border-2 border-border shadow-sm">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Weekly Quota</p>
                      <p className="text-2xl font-bold tracking-tight">{quotaInfo.usedHours}<span className="text-muted-foreground">/{quotaInfo.limitHours}</span> <span className="text-base font-normal text-muted-foreground">hrs</span></p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center border-2 border-neutral-700 dark:border-neutral-300 shadow-md">
                      <span className="text-white dark:text-black text-sm font-bold">{Math.round((quotaInfo.usedHours / quotaInfo.limitHours) * 100)}%</span>
                    </div>
                  </div>
                )}

                {/* Faculty Unlimited Badge */}
                {user?.role === "FACULTY" && (
                  <Badge className="px-4 py-2 bg-neutral-800 dark:bg-neutral-200 dark:text-black text-white border-0 text-sm">
                    ✨ Unlimited Access
                  </Badge>
                )}

                {/* Admin Quick Action */}
                {user?.role === "ADMIN" && (
                  <Button
                    onClick={() => router.push("/admin")}
                    className="bg-neutral-900 dark:bg-neutral-100 dark:text-black text-white hover:bg-neutral-800 dark:hover:bg-neutral-300"
                  >
                    Open Admin Panel →
                  </Button>
                )}

                {/* Upcoming Bookings Count */}
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-background border">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                    <p className="text-lg font-bold">{bookings.filter(b => new Date(b.start) > new Date()).length}</p>
                  </div>
                  <Calendar className="h-5 w-5 text-foreground" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-6">
          {/* Mobile: Sheet Sidebar (overlay) */}
          <Sheet open={sidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="p-6 pb-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-white dark:text-black" />
                  </div>
                  Room Filters
                </SheetTitle>
                <SheetDescription>
                  Filter rooms by type, capacity, and amenities
                </SheetDescription>
              </SheetHeader>
              <div className="p-6 overflow-y-auto max-h-[calc(100vh-120px)]">
                <RoomFilter
                  filters={filters}
                  onFiltersChange={setFilters}
                  collapsible
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop: Fixed Glassmorphism Sidebar */}
          <motion.aside
            initial={false}
            animate={{
              width: sidebarOpen ? 320 : 0,
              opacity: sidebarOpen ? 1 : 0,
              marginRight: sidebarOpen ? 24 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 }
            }}
            className="hidden lg:block overflow-hidden flex-shrink-0"
          >
            <div className="sticky top-24 rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl shadow-xl overflow-hidden">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-border/50 bg-secondary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center shadow-lg">
                      <Calendar className="h-5 w-5 text-white dark:text-black" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Filters</h3>
                      <p className="text-xs text-muted-foreground">{filteredRooms.length} rooms</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(false)}
                    className="h-8 w-8 rounded-lg hover:bg-background/80"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Sidebar Content */}
              <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                <RoomFilter
                  filters={filters}
                  onFiltersChange={setFilters}
                  collapsible
                />
              </div>
            </div>
          </motion.aside>

          {/* Collapsed Sidebar Toggle - Desktop */}
          {!sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="hidden lg:block flex-shrink-0"
            >
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="sticky top-24 h-12 w-12 rounded-xl border-border/50 bg-background/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {/* Main Content */}
          <main className="flex-1">
            {/* View Controls */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">
                  {filteredRooms.length} rooms available
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Mobile Filter Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden flex items-center gap-2"
                >
                  <PanelLeft className="h-4 w-4" />
                  Filters
                </Button>

                {/* View Mode Toggle */}
                <div className="flex rounded-lg border bg-muted p-1">
                  <Button
                    variant={viewMode === "calendar" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("calendar")}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>

                {/* Fairness Policy (US 4.10) */}
                <FairnessPolicyModal
                  quotaUsed={quotaInfo?.usedHours || 0}
                  quotaLimit={quotaInfo?.limitHours || 4}
                />

                {/* New Booking Button */}
                <Button onClick={() => setIsBookingModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Booking
                </Button>
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-[600px] w-full rounded-lg" />
              </div>
            ) : viewMode === "calendar" ? (
              /* Calendar View */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <BookingCalendar
                  events={bookings}
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                />
              </motion.div>
            ) : viewMode === "grid" ? (
              /* Grid View */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
              >
                {filteredRooms.map((room, index) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <RoomCard
                      room={room}
                      onBook={handleBookRoom}
                      onViewDetails={(room) => router.push(`/rooms/${room.id}`)}
                      onNotify={handleNotifyMe}
                      isNotifying={notifyingRoomId === room.id}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              /* List View */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-secondary" />
                      <div>
                        <h3 className="font-semibold">{room.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {room.building}, Floor {room.floor} • {room.capacity}{" "}
                          seats
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={room.isAvailable ? "success" : "destructive"}
                      >
                        {room.isAvailable ? "Available" : "Occupied"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/rooms/${room.id}`)}
                      >
                        View
                      </Button>
                      {room.isAvailable ? (
                        <Button
                          size="sm"
                          onClick={() => handleBookRoom(room)}
                        >
                          Book
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => handleNotifyMe(room)}
                          disabled={notifyingRoomId === room.id}
                        >
                          <Bell className="mr-1 h-4 w-4" />
                          Notify
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setSelectedRoom(null);
          setSelectedSlot(null);
        }}
        room={selectedRoom}
        rooms={filteredRooms.length > 0 ? filteredRooms : rooms}
        onSubmit={handleBookingSubmit}
        selectedDate={selectedSlot?.date}
        selectedStartTime={selectedSlot?.startTime}
        isAdmin={currentUser?.role === "ADMIN"}
      />

      {/* Booking Details Modal - Teams/Meet Style */}
      <BookingDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onEdit={handleEditBooking}
        onCancel={handleCancelBooking}
        onCheckIn={handleCheckInFromDetails}
        onEarlyCheckout={handleEarlyCheckout}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={isRescheduleModalOpen}
        onClose={() => {
          setIsRescheduleModalOpen(false);
          setBookingToReschedule(null);
        }}
        booking={bookingToReschedule}
        onReschedule={handleReschedule}
      />
    </div>
  );
}
