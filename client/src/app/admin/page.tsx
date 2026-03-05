"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Building2,
  Calendar,
  BarChart3,
  Settings,
  Shield,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  Upload,
  Filter,
  MoreVertical,
  LogOut,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Zap,
  Eye,
  User,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  Home,
  Wrench,
  MessageSquare,
  Send,
  Megaphone,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { roomsApi, bookingsApi, adminApi } from "@/lib/api";
import { AddRoomModal } from "@/components/admin/AddRoomModal";
import { EditRoomAmenitiesModal } from "@/components/admin/EditRoomAmenitiesModal";
import { BulkImportTimetableModal } from "@/components/admin/BulkImportTimetableModal";
import { HolidayCalendarModal } from "@/components/admin/HolidayCalendarModal";
import { ExportBookingsModal } from "@/components/admin/ExportBookingsModal";
import { MaintenanceModeModal } from "@/components/admin/MaintenanceModeModal";
import { FeedbackReviewModal } from "@/components/admin/FeedbackReviewModal";
import { SystemConfigModal } from "@/components/admin/SystemConfigModal";
import { BookingApprovals } from "@/components/admin/BookingApprovals";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { AddUserModal } from "@/components/admin/AddUserModal";
import { ViewUserDetailsModal } from "@/components/admin/ViewUserDetailsModal";
import { ViewRoomDetailsModal } from "@/components/admin/ViewRoomDetailsModal";
import { EditRoomModal } from "@/components/admin/EditRoomModal";

// Types
interface Stats {
  totalUsers: number;
  totalRooms: number;
  totalBookings: number;
  activeBookings: number;
  utilizationRate: number;
  noShowRate: number;
  pendingApprovals: number;
  todayBookings: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  reputationScore: number;
  createdAt: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
}

interface Room {
  id: string;
  name: string;
  code?: string;
  building?: string;
  capacity: number;
  roomType?: string;
  isAvailable?: boolean;
}

interface Booking {
  id: string;
  title?: string;
  startTime: string;
  endTime: string;
  status: string;
  room?: { name: string; code?: string };
  user?: { name: string; email: string };
}

type AdminTab = "overview" | "users" | "rooms" | "bookings" | "approvals" | "audit_logs" | "analytics" | "broadcast" | "settings";

// Sidebar navigation
const navItems: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "rooms", label: "Rooms", icon: Building2 },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "approvals", label: "Approvals", icon: CheckCircle },
  { id: "audit_logs", label: "Audit Logs", icon: Activity },
  { id: "broadcast", label: "Broadcast", icon: Megaphone },
  { id: "analytics", label: "Analytics", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

// Gradient backgrounds for stat cards
const gradients = [
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-blue-500",
  "from-emerald-500 to-green-500",
  "from-orange-500 to-amber-500",
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isViewUserModalOpen, setIsViewUserModalOpen] = useState(false);
  const [selectedUserForView, setSelectedUserForView] = useState<AdminUser | null>(null);
  const [selectedRoomForView, setSelectedRoomForView] = useState<any>(null);
  const [selectedRoomForEdit, setSelectedRoomForEdit] = useState<any>(null);
  const [selectedRoomForAmenities, setSelectedRoomForAmenities] = useState<any>(null);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isHolidayCalendarOpen, setIsHolidayCalendarOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedRoomForMaintenance, setSelectedRoomForMaintenance] = useState<any>(null);
  const [isFeedbackReviewOpen, setIsFeedbackReviewOpen] = useState(false);
  const [isSystemConfigOpen, setIsSystemConfigOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const { toast } = useToast();

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Update current time (client-side only to avoid hydration mismatch)
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data from API
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [roomsRes, bookingsRes, usersRes, statsRes] = await Promise.all([
        roomsApi.search(),
        bookingsApi.getAllBookings(),
        adminApi.getUsers({ limit: 100 }),
        adminApi.getStats(),
      ]);

      const roomsData = roomsRes.data.data || [];
      const bookingsData = bookingsRes.data.data || [];
      const usersData = usersRes.data.data || [];
      const backendStats = statsRes.data.data;

      setRooms(roomsData);
      setBookings(bookingsData);

      // Map users data to AdminUser format
      const mappedUsers: AdminUser[] = usersData.map((u: any) => ({
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email?.split('@')[0] || 'Unknown',
        email: u.email || '',
        role: u.role || 'STUDENT',
        department: u.departmentName || 'Not assigned', // Fixed: departmentName instead of department.name
        reputationScore: u.reputationScore ?? 100,
        createdAt: u.createdAt || new Date().toISOString(),
        status: u.blockedUntil && new Date(u.blockedUntil) > new Date() ? 'SUSPENDED' : 'ACTIVE',
      }));

      setUsers(mappedUsers);

      // Use backend stats for accurate data, with local fallback
      const pendingApprovals = bookingsData.filter(
        (b: any) => b.status === "PENDING_APPROVAL"
      ).length;
      const today = new Date().toDateString();
      const todayBookings = bookingsData.filter(
        (b: any) => new Date(b.startTime).toDateString() === today
      ).length;

      setStats({
        totalUsers: backendStats?.totalUsers || usersData.length || mappedUsers.length,
        totalRooms: backendStats?.totalRooms || roomsData.length,
        totalBookings: backendStats?.totalBookings || bookingsData.length,
        activeBookings: backendStats?.activeBookings || 0,
        utilizationRate: backendStats?.utilizationRate ?? 0,
        noShowRate: backendStats?.noShowRate ?? 0,
        pendingApprovals,
        todayBookings,
      });
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
      // Fallback to mock user if API fails
      setUsers([
        {
          id: "1",
          name: user?.name || "Admin User",
          email: "admin@amrita.edu",
          role: user?.role || "ADMIN",
          department: "Administration",
          reputationScore: 100,
          createdAt: new Date().toISOString(),
          status: "ACTIVE",
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Handle room creation
  const handleCreateRoom = async (data: any) => {
    try {
      await roomsApi.create(data);
      await fetchData(true); // Refresh data
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to create room");
    }
  };

  // Handle deleting a room
  const handleDeleteRoom = async (room: any) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the room "${room.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await roomsApi.update(room.id, { is_active: false } as any);
      toast({ title: "Success", description: `Room "${room.name}" deleted successfully` });
      await fetchData(true);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete room", variant: "destructive" });
    }
  };

  // Handle creating user
  const handleCreateUser = async (data: any) => {
    try {
      await adminApi.createUser(data);
      toast({
        title: "Success",
        description: "User created successfully",
      });
      await fetchData(true); // Refresh data
    } catch (error: any) {
      throw new Error(error?.response?.data?.error?.message || error.message || "Failed to create user");
    }
  };

  // Handle viewing a user
  const handleViewUser = (user: AdminUser) => {
    setSelectedUserForView(user);
    setIsViewUserModalOpen(true);
  };

  // Handle deleting a user
  const handleDeleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the user ${user.name} (${user.email})? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await adminApi.deleteUser(user.id);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      await fetchData(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error?.message || error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  // Handle user role update
  const handleUpdateUserRole = async (userId: string, userName: string, currentRole: string, newRole: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to change ${userName}'s role from ${currentRole} to ${newRole}?`
    );

    if (!confirmed) return;

    try {
      await adminApi.updateUserRole(userId, newRole);
      toast({
        title: 'Role Updated',
        description: `${userName}'s role has been changed to ${newRole}`,
      });
      await fetchData(true); // Refresh data
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.response?.data?.error?.message || 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  // Handle users export
  const handleExportUsers = () => {
    try {
      // Create CSV content
      const headers = ['Name', 'Email', 'Role', 'Department', 'Reputation Score', 'Status', 'Created At'];
      const rows = filteredUsers.map(u => [
        u.name || '',
        u.email || '',
        u.role || '',
        u.department || '',
        u.reputationScore?.toString() || '0',
        u.status || 'ACTIVE',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and download blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Exported ${filteredUsers.length} users to CSV`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export users data',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter users
  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const userName = u.name || "";
      const userEmail = u.email || "";
      const matchesSearch =
        userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        userEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Stats cards with gradients
  const statsCards = [
    {
      title: "Total Rooms",
      value: stats?.totalRooms ?? 0,
      icon: Building2,
      change: "+2 this week",
      trend: "up",
      gradient: gradients[0],
    },
    {
      title: "Active Bookings",
      value: stats?.activeBookings ?? 0,
      icon: CalendarCheck,
      change: `${stats?.todayBookings ?? 0} today`,
      trend: "up",
      gradient: gradients[1],
    },
    {
      title: "Total Bookings",
      value: stats?.totalBookings ?? 0,
      icon: Calendar,
      change: "+12% vs last week",
      trend: "up",
      gradient: gradients[2],
    },
    {
      title: "Utilization Rate",
      value: `${stats?.utilizationRate ?? 0}%`,
      icon: TrendingUp,
      change: "Above target",
      trend: "up",
      gradient: gradients[3],
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    document.cookie = "accessToken=; path=/; max-age=0";
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-72 border-r bg-card">
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
            <Shield className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <span className="text-lg font-bold">Admin Panel</span>
            <p className="text-xs text-muted-foreground">CampusRes Management</p>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <motion.button
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
                {item.id === "bookings" && stats?.pendingApprovals ? (
                  <Badge className="ml-auto bg-orange-500 text-white">{stats.pendingApprovals}</Badge>
                ) : null}
              </motion.button>
            );
          })}
        </nav>

        {/* Back to Dashboard Link */}
        <div className="absolute bottom-4 left-4 right-4">
          <Link href="/dashboard">
            <Button variant="outline" className="w-full gap-2">
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-72 flex-1 p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold"
            >
              {navItems.find((item) => item.id === activeTab)?.label}
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.name || "Admin"}! Here&apos;s what&apos;s happening today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {user?.name?.charAt(0) || "A"}
                  </div>
                  {user?.name || "Admin"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Stats Grid with Gradient Cards */}
              <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {statsCards.map((stat, index) => {
                  const Icon = stat.icon;
                  return isLoading ? (
                    <Skeleton key={index} className="h-36" />
                  ) : (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-lg bg-primary/10">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex items-center gap-1 text-sm text-emerald-500">
                              <TrendingUp className="h-4 w-4" />
                              {stat.trend === "up" ? "↑" : "↓"}
                            </div>
                          </div>
                          <div className="text-3xl font-bold mb-1">{stat.value}</div>
                          <p className="text-sm text-muted-foreground">{stat.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Quick Actions & Activity */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Recent Activity */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Latest booking activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {bookings.slice(0, 5).map((booking, i) => (
                        <motion.div
                          key={booking.id || i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            booking.status === "CONFIRMED" ? "bg-emerald-500/10 text-emerald-500" :
                              booking.status === "PENDING" ? "bg-amber-500/10 text-amber-500" :
                                "bg-muted-foreground/10 text-muted-foreground"
                          )}>
                            {booking.status === "CONFIRMED" ? <CheckCircle2 className="h-5 w-5" /> :
                              booking.status === "PENDING" ? <Clock className="h-5 w-5" /> :
                                <Calendar className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{booking.title || "Room Booking"}</p>
                            <p className="text-sm text-muted-foreground">
                              {booking.room?.name || "Room"} • {new Date(booking.startTime).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={
                            booking.status === "CONFIRMED" ? "success" :
                              booking.status === "PENDING" ? "warning" :
                                "secondary"
                          }>
                            {booking.status}
                          </Badge>
                        </motion.div>
                      ))}
                      {bookings.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No recent bookings
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* System Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      System Status
                    </CardTitle>
                    <CardDescription>Current system health</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { name: "API Server", status: "healthy" },
                        { name: "Database", status: "healthy" },
                        { name: "Redis Cache", status: "healthy" },
                        { name: "Background Jobs", status: "healthy" },
                      ].map((item, i) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <span className="text-sm font-medium">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs text-emerald-500 font-medium">Healthy</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-6 p-4 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span className="font-medium">All Systems Operational</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last checked: {currentTime || 'Loading...'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="rounded-lg ">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 gap-4">
                      <div className="relative flex-1 sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-40">
                          <Filter className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Filter role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="STUDENT">Student</SelectItem>
                          <SelectItem value="FACULTY">Faculty</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="LAB_ADMIN">Lab Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleExportUsers}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                      <Button onClick={() => setIsAddUserModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Reputation</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                              <td className="px-4 py-4" colSpan={6}>
                                <Skeleton className="h-12 rounded-lg" />
                              </td>
                            </tr>
                          ))
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                              No users found
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((u, index) => (
                            <motion.tr
                              key={u.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="border-b hover:bg-muted/50 transition-colors"
                            >
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                                    <User className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{u.name}</p>
                                    <p className="text-sm text-muted-foreground">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <Badge variant="outline" className="rounded-lg">{u.role}</Badge>
                              </td>
                              <td className="px-4 py-4 text-muted-foreground">
                                {u.department || "-"}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        u.reputationScore >= 90 ? "bg-emerald-500" :
                                          u.reputationScore >= 70 ? "bg-amber-500" : "bg-red-500"
                                      )}
                                      style={{ width: `${u.reputationScore}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium">{u.reputationScore}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <Badge
                                  className={cn(
                                    "rounded-lg",
                                    u.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                      u.status === "SUSPENDED" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                        "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                  )}
                                >
                                  {u.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="rounded-lg">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewUser(u)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteUser(u)} className="text-destructive focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete User
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        Change Role
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent>
                                        <DropdownMenuItem
                                          onClick={() => handleUpdateUserRole(u.id, u.name, u.role, 'STUDENT')}
                                          disabled={u.role === 'STUDENT'}
                                        >
                                          <Users className="mr-2 h-3 w-3" />
                                          Student
                                          {u.role === 'STUDENT' && ' (Current)'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleUpdateUserRole(u.id, u.name, u.role, 'LAB_ADMIN')}
                                          disabled={u.role === 'LAB_ADMIN'}
                                        >
                                          <Building2 className="mr-2 h-3 w-3" />
                                          Lab Admin
                                          {u.role === 'LAB_ADMIN' && ' (Current)'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleUpdateUserRole(u.id, u.name, u.role, 'FACULTY')}
                                          disabled={u.role === 'FACULTY'}
                                        >
                                          <UserCheck className="mr-2 h-3 w-3" />
                                          Faculty
                                          {u.role === 'FACULTY' && ' (Current)'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleUpdateUserRole(u.id, u.name, u.role, 'ADMIN')}
                                          disabled={u.role === 'ADMIN'}
                                        >
                                          <Shield className="mr-2 h-3 w-3" />
                                          Admin
                                          {u.role === 'ADMIN' && ' (Current)'}
                                        </DropdownMenuItem>
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Rooms Tab */}
          {activeTab === "rooms" && (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="rounded-lg ">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Rooms ({rooms.length})</CardTitle>
                      <CardDescription>Manage campus rooms and facilities</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-lg" onClick={() => fetchData(true)}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                        Refresh
                      </Button>
                      <Button
                        className="rounded-lg bg-neutral-900 dark:bg-neutral-100 dark:text-black text-white hover:bg-neutral-800 dark:hover:bg-neutral-300"
                        onClick={() => setIsAddRoomModalOpen(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Room
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room, index) => (
                      <motion.div
                        key={room.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="rounded-lg hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                              <Badge variant={room.isMaintenance ? "destructive" : "success"}>
                                {room.isMaintenance ? "Maintenance" : "Available"}
                              </Badge>
                            </div>
                            <h3 className="font-semibold mb-1">{room.name}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{room.code}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{room.building}</span>
                              <span>•</span>
                              <span>{room.capacity} seats</span>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => setSelectedRoomForView(room)}>
                                <Eye className="mr-1 h-3 w-3" />
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="rounded-lg">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedRoomForAmenities(room)}>
                                    <Settings className="mr-2 h-3 w-3" />
                                    Manage Amenities
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setSelectedRoomForMaintenance(room)}>
                                    <Wrench className="mr-2 h-3 w-3" />
                                    {room.isMaintenance ? "Disable Maintenance" : "Enable Maintenance"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setSelectedRoomForEdit(room)}>
                                    <Pencil className="mr-2 h-3 w-3" />
                                    Edit Room
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRoom(room)}>
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                  {rooms.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No rooms found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Bookings Tab */}
          {activeTab === "bookings" && (
            <motion.div
              key="bookings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="rounded-lg ">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Bookings ({bookings.length})</CardTitle>
                      <CardDescription>View and manage all booking requests</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => setIsExportModalOpen(true)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button
                        className="rounded-lg bg-neutral-900 dark:bg-neutral-100 dark:text-black text-white hover:bg-neutral-800 dark:hover:bg-neutral-300"
                        onClick={() => setIsBulkImportModalOpen(true)}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import Timetable
                      </Button>
                      <Button
                        className="rounded-lg"
                        variant="outline"
                        onClick={() => setIsHolidayCalendarOpen(true)}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Holiday Calendar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {bookings.map((booking, index) => (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-md transition-all"
                      >
                        <div className={cn(
                          "h-12 w-12 rounded-lg flex items-center justify-center",
                          booking.status === "CONFIRMED" ? "bg-emerald-500/10" :
                            booking.status === "PENDING" ? "bg-amber-500/10" :
                              booking.status === "CANCELLED" ? "bg-red-500/10" :
                                "bg-muted"
                        )}>
                          {booking.status === "CONFIRMED" ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> :
                            booking.status === "PENDING" ? <Clock className="h-6 w-6 text-amber-500" /> :
                              booking.status === "CANCELLED" ? <XCircle className="h-6 w-6 text-red-500" /> :
                                <Calendar className="h-6 w-6 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{booking.title || "Room Booking"}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.room?.name || "Room"} • {new Date(booking.startTime).toLocaleDateString()} at {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge variant={
                          booking.status === "CONFIRMED" ? "success" :
                            booking.status === "PENDING" ? "warning" :
                              booking.status === "CANCELLED" ? "destructive" :
                                "secondary"
                        }>
                          {booking.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-lg">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </motion.div>
                    ))}
                    {bookings.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No bookings found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Approvals Tab */}
          {activeTab === "approvals" && (
            <motion.div
              key="approvals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-4">Pending Approvals</h2>
              <BookingApprovals />
            </motion.div>
          )}

          {/* Audit Logs Tab */}
          {activeTab === "audit_logs" && (
            <motion.div
              key="audit_logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-4">System Audit Logs</h2>
              <AuditLogTable />
            </motion.div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center py-20"
            >
              <div className="p-6 rounded-full bg-primary/10 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <BarChart3 className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Analytics Coming Soon</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Advanced analytics with demand forecasting, utilization reports, and department-wise insights will be available soon.
              </p>
            </motion.div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Settings & Management</h2>
                  <p className="text-muted-foreground">System configuration and feedback management</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Feedback Review Card */}
                <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setIsFeedbackReviewOpen(true)}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-orange-500/10">
                        <MessageSquare className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Feedback Review</CardTitle>
                        <CardDescription>Review and manage user feedback</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      View user-reported issues about rooms, manage status updates, and track resolutions.
                    </p>
                    <Button variant="outline" className="w-full mt-4">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Open Feedback
                    </Button>
                  </CardContent>
                </Card>

                {/* Holiday Calendar Card */}
                <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setIsHolidayCalendarOpen(true)}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-blue-500/10">
                        <CalendarDays className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Holiday Calendar</CardTitle>
                        <CardDescription>Manage campus holidays</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Configure public holidays and campus closures to prevent bookings.
                    </p>
                    <Button variant="outline" className="w-full mt-4">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Open Calendar
                    </Button>
                  </CardContent>
                </Card>

                {/* System Configuration Card */}
                <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setIsSystemConfigOpen(true)}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Settings className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">System Config</CardTitle>
                        <CardDescription>Booking rules & settings</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Configure booking limits, campus hours, and system-wide settings.
                    </p>
                    <Button variant="outline" className="w-full mt-4">
                      <Settings className="mr-2 h-4 w-4" />
                      Open Settings
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Broadcast Tab */}
          {activeTab === "broadcast" && (
            <motion.div
              key="broadcast"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <Megaphone className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Send Broadcast Email</CardTitle>
                      <CardDescription>Send an email notification to all registered users</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Subject */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject *</label>
                    <Input
                      placeholder="e.g. Campus Closure Notice, Maintenance Update..."
                      value={broadcastSubject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBroadcastSubject(e.target.value)}
                      maxLength={200}
                      disabled={isSendingBroadcast}
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message / Reason *</label>
                    <Textarea
                      placeholder="Enter the broadcast message with the reason for this notification..."
                      value={broadcastMessage}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBroadcastMessage(e.target.value)}
                      rows={6}
                      maxLength={1000}
                      disabled={isSendingBroadcast}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {broadcastMessage.length} / 1000 characters
                    </p>
                  </div>

                  {/* Warning */}
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">This will email all users</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The broadcast will be sent to every registered user in the system. Please double-check your message before sending.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Send Button */}
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    disabled={!broadcastSubject.trim() || !broadcastMessage.trim() || isSendingBroadcast}
                    onClick={async () => {
                      const confirmed = window.confirm(
                        `Are you sure you want to send this broadcast email to ALL users?\n\nSubject: ${broadcastSubject}\nMessage: ${broadcastMessage.substring(0, 100)}${broadcastMessage.length > 100 ? '...' : ''}`
                      );
                      if (!confirmed) return;

                      setIsSendingBroadcast(true);
                      try {
                        const res = await adminApi.sendBroadcast({
                          subject: broadcastSubject,
                          message: broadcastMessage,
                        });
                        const data = res.data.data as any;
                        toast({
                          title: 'Broadcast Sent \u2713',
                          description: `Email sent to ${data?.recipientCount || 'all'} users (${data?.successCount || 0} successful, ${data?.failCount || 0} failed).`,
                        });
                        setBroadcastSubject('');
                        setBroadcastMessage('');
                      } catch (error: any) {
                        toast({
                          title: 'Broadcast Failed',
                          description: error.message || 'Failed to send broadcast email.',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsSendingBroadcast(false);
                      }
                    }}
                  >
                    {isSendingBroadcast ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending to all users...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Broadcast
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSubmit={handleCreateUser}
      />
      <ViewUserDetailsModal
        user={selectedUserForView}
        isOpen={isViewUserModalOpen}
        onClose={() => setIsViewUserModalOpen(false)}
      />
      <ViewRoomDetailsModal
        room={selectedRoomForView}
        isOpen={!!selectedRoomForView}
        onClose={() => setSelectedRoomForView(null)}
      />
      <EditRoomModal
        room={selectedRoomForEdit}
        isOpen={!!selectedRoomForEdit}
        onClose={() => setSelectedRoomForEdit(null)}
        onSuccess={() => fetchData(true)}
      />
      <AddRoomModal
        isOpen={isAddRoomModalOpen}
        onClose={() => setIsAddRoomModalOpen(false)}
        onSubmit={handleCreateRoom}
      />
      <EditRoomAmenitiesModal
        room={selectedRoomForAmenities}
        isOpen={!!selectedRoomForAmenities}
        onClose={() => setSelectedRoomForAmenities(null)}
        onSuccess={() => fetchData(true)}
      />
      <BulkImportTimetableModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onSuccess={() => fetchData(true)}
      />
      <HolidayCalendarModal
        isOpen={isHolidayCalendarOpen}
        onClose={() => setIsHolidayCalendarOpen(false)}
      />
      <ExportBookingsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
      <MaintenanceModeModal
        room={selectedRoomForMaintenance}
        isOpen={!!selectedRoomForMaintenance}
        onClose={() => setSelectedRoomForMaintenance(null)}
        onSuccess={() => fetchData(true)}
      />
      <FeedbackReviewModal
        isOpen={isFeedbackReviewOpen}
        onClose={() => setIsFeedbackReviewOpen(false)}
      />
      <SystemConfigModal
        isOpen={isSystemConfigOpen}
        onClose={() => setIsSystemConfigOpen(false)}
      />
    </div>
  );
}

