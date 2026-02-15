"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    User,
    Mail,
    Calendar,
    Star,
    CreditCard,
    Settings,
    Bell,
    LogOut,
    Clock,
    ChevronLeft,
    Loader2,
    Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
// Progress component not available, using custom div-based progress
import { useAuth } from "@/contexts/AuthContext";
import { bookingsApi, authApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
// import { ThemeToggle } from "@/components/ui/theme-toggle"; // Removed

interface QuotaInfo {
    usedHours: number;
    limitHours: number;
    remainingHours: number;
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, logout, isLoading, isInitialized } = useAuth();
    const { toast } = useToast();

    const [notifications, setNotifications] = useState(true);
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [bookingCount, setBookingCount] = useState(0);
    const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Fetch user stats
    const fetchStats = useCallback(async () => {
        try {
            const [bookingsResponse, quotaResponse] = await Promise.allSettled([
                bookingsApi.getMyBookings(),
                authApi.getQuota(),
            ]);

            if (bookingsResponse.status === "fulfilled") {
                setBookingCount(bookingsResponse.value.data.data?.length || 0);
            }

            if (quotaResponse.status === "fulfilled") {
                setQuotaInfo(quotaResponse.value.data.data as unknown as QuotaInfo);
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setIsLoadingData(false);
        }
    }, []);

    useEffect(() => {
        // Wait for auth to be initialized before redirecting
        if (!isInitialized) return;

        // Don't redirect while auth is still loading
        if (isLoading) return;

        if (!user) {
            router.push("/auth/login");
            return;
        }
        fetchStats();
    }, [user, isInitialized, isLoading, router, fetchStats]);

    const handleLogout = async () => {
        try {
            await logout();
            toast({
                title: "Signed out",
                description: "You have been signed out successfully.",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to sign out. Please try again.",
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const usedHours = quotaInfo?.usedHours ?? 0;
    const limitHours = quotaInfo?.limitHours ?? (user as any).quotaLimitHours ?? 10;
    const remainingHours = quotaInfo?.remainingHours ?? (limitHours - usedHours);
    const quotaPercentage = Math.min((usedHours / limitHours) * 100, 100);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Dashboard
                        </Button>
                    </div>
                    <h1 className="text-xl font-semibold">My Profile</h1>
                    {/* <ThemeToggle /> */}
                </div>
            </header>

            <main className="container mx-auto max-w-4xl px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    {/* Profile Header Card */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center gap-6 sm:flex-row">
                                <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                                    <AvatarImage src={user.avatarUrl} />
                                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-center sm:text-left">
                                    <h2 className="text-2xl font-bold">{user.name}</h2>
                                    <p className="text-muted-foreground">{user.email}</p>
                                    <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                                        <Badge className="bg-primary/10 text-primary border-primary/20">
                                            <Shield className="mr-1 h-3 w-3" />
                                            {user.role}
                                        </Badge>
                                        {user.departmentName && (
                                            <Badge variant="outline">{user.departmentName}</Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Button variant="outline" size="sm" onClick={() => router.push("/settings")}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Settings
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Reputation
                                </CardTitle>
                                <Star className="h-4 w-4 text-yellow-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{user.reputationScore || 100}</div>
                                <p className="text-xs text-muted-foreground">
                                    Booking reliability score
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Credits
                                </CardTitle>
                                <CreditCard className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{(user as any).creditsBalance || 100}</div>
                                <p className="text-xs text-muted-foreground">
                                    Available booking credits
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Bookings
                                </CardTitle>
                                <Calendar className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {isLoadingData ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        bookingCount
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Total bookings made
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Hours Left
                                </CardTitle>
                                <Clock className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {isLoadingData ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        remainingHours
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Weekly quota remaining
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quota Usage */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Weekly Quota Usage
                            </CardTitle>
                            <CardDescription>
                                {usedHours} of {limitHours} hours used this week
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Used: {usedHours}h</span>
                                    <span>Remaining: {remainingHours}h</span>
                                </div>
                                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${quotaPercentage > 80
                                            ? "bg-red-500"
                                            : quotaPercentage > 50
                                                ? "bg-yellow-500"
                                                : "bg-green-500"
                                            }`}
                                        style={{ width: `${quotaPercentage}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Account Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Account Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground">Full Name</Label>
                                    <p className="font-medium">{user.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground">Email</Label>
                                    <p className="font-medium">{user.email}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground">Role</Label>
                                    <p className="font-medium capitalize">{user.role?.toLowerCase().replace("_", " ")}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground">Department</Label>
                                    <p className="font-medium">{user.departmentName || "Not assigned"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preferences */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Preferences
                            </CardTitle>
                            <CardDescription>
                                Manage your notification and alert settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <Bell className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <Label htmlFor="notifications" className="font-medium">Push Notifications</Label>
                                        <p className="text-xs text-muted-foreground">Get notified about booking updates</p>
                                    </div>
                                </div>
                                <Switch
                                    id="notifications"
                                    checked={notifications}
                                    onCheckedChange={setNotifications}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <Mail className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <Label htmlFor="emailAlerts" className="font-medium">Email Alerts</Label>
                                        <p className="text-xs text-muted-foreground">Receive booking confirmations via email</p>
                                    </div>
                                </div>
                                <Switch
                                    id="emailAlerts"
                                    checked={emailAlerts}
                                    onCheckedChange={setEmailAlerts}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Button
                            variant="outline"
                            className="h-auto py-4"
                            onClick={() => router.push("/bookings")}
                        >
                            <Calendar className="mr-2 h-5 w-5" />
                            <div className="text-left">
                                <div className="font-medium">View My Bookings</div>
                                <div className="text-xs text-muted-foreground">See all your reservations</div>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-auto py-4"
                            onClick={() => router.push("/dashboard")}
                        >
                            <Calendar className="mr-2 h-5 w-5" />
                            <div className="text-left">
                                <div className="font-medium">Book a Room</div>
                                <div className="text-xs text-muted-foreground">Make a new reservation</div>
                            </div>
                        </Button>
                    </div>

                    {/* Logout */}
                    <Button
                        variant="destructive"
                        className="w-full"
                        onClick={handleLogout}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </motion.div>
            </main>
        </div>
    );
}
