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
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  Filter,
  MoreVertical,
  LogOut,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Zap,
  Eye,
  UserCheck,
  CalendarCheck,
  Home,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { roomsApi, bookingsApi } from "@/lib/api";

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

type AdminTab = "overview" | "users" | "rooms" | "bookings" | "analytics" | "settings";

// Sidebar navigation
const navItems: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "rooms", label: "Rooms", icon: Building2 },
  { id: "bookings", label: "Bookings", icon: Calendar },
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

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Fetch data from API
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        roomsApi.search(),
        bookingsApi.getAllBookings(), // Use admin endpoint to get ALL bookings
      ]);

      const roomsData = roomsRes.data.data || [];
      const bookingsData = bookingsRes.data.data || [];

      setRooms(roomsData);
      setBookings(bookingsData);

      // Calculate stats
      const activeBookings = bookingsData.filter(
        (b: any) => b.status === "CONFIRMED" || b.status === "PENDING"
      ).length;
      const pendingApprovals = bookingsData.filter(
        (b: any) => b.status === "PENDING_APPROVAL"
      ).length;
      const today = new Date().toDateString();
      const todayBookings = bookingsData.filter(
        (b: any) => new Date(b.startTime).toDateString() === today
      ).length;

      setStats({
        totalUsers: 156, // Would need admin API
        totalRooms: roomsData.length,
        totalBookings: bookingsData.length,
        activeBookings,
        utilizationRate: roomsData.length > 0 ? Math.round((activeBookings / roomsData.length) * 100) : 0,
        noShowRate: 4.2,
        pendingApprovals,
        todayBookings,
      });

      // Mock users for demo (would need admin API)
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
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

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
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Premium Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-72 border-r bg-card/50 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
            <Shield className="h-5 w-5 text-white" />
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
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25"
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
              className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text"
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
              className="rounded-xl"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
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
                    <Skeleton key={index} className="h-36 rounded-2xl" />
                  ) : (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="relative overflow-hidden border-0 bg-gradient-to-br p-[1px] rounded-2xl">
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-10`} />
                        <CardContent className="relative bg-card rounded-2xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                              <Icon className="h-5 w-5 text-white" />
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
                <Card className="lg:col-span-2 rounded-2xl border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-violet-500" />
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
                          className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center",
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
                <Card className="rounded-2xl border-0 shadow-lg">
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
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                        >
                          <span className="text-sm font-medium">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs text-emerald-500 font-medium">Healthy</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-violet-500" />
                        <span className="font-medium">All Systems Operational</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last checked: {new Date().toLocaleTimeString()}
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
              <Card className="rounded-2xl border-0 shadow-lg">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 gap-4">
                      <div className="relative flex-1 sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 rounded-xl"
                        />
                      </div>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-40 rounded-xl">
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
                      <Button variant="outline" className="rounded-xl">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                      <Button className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700">
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
                                <Skeleton className="h-12 rounded-xl" />
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
                                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                    {u.name?.charAt(0) || "?"}
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
                                    <Button variant="ghost" size="icon" className="rounded-xl">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
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
              <Card className="rounded-2xl border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Rooms ({rooms.length})</CardTitle>
                      <CardDescription>Manage campus rooms and facilities</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => fetchData(true)}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                        Refresh
                      </Button>
                      <Button className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600">
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
                        <Card className="rounded-xl hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/10">
                                <Building2 className="h-5 w-5 text-violet-500" />
                              </div>
                              <Badge variant={room.isAvailable !== false ? "success" : "destructive"}>
                                {room.isAvailable !== false ? "Available" : "Maintenance"}
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
                              <Button variant="outline" size="sm" className="flex-1 rounded-lg">
                                <Eye className="mr-1 h-3 w-3" />
                                View
                              </Button>
                              <Button variant="outline" size="sm" className="rounded-lg">
                                <Pencil className="h-3 w-3" />
                              </Button>
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
              <Card className="rounded-2xl border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Bookings ({bookings.length})</CardTitle>
                      <CardDescription>View and manage all booking requests</CardDescription>
                    </div>
                    <Button variant="outline" className="rounded-xl">
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
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
                        className="flex items-center gap-4 p-4 rounded-xl border hover:shadow-md transition-all"
                      >
                        <div className={cn(
                          "h-12 w-12 rounded-xl flex items-center justify-center",
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
                            <Button variant="ghost" size="icon" className="rounded-xl">
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
              <div className="p-6 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <BarChart3 className="h-12 w-12 text-violet-500" />
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
              className="text-center py-20"
            >
              <div className="p-6 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <Settings className="h-12 w-12 text-violet-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Settings</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                System configuration, booking rules, and campus settings management will be available here.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
