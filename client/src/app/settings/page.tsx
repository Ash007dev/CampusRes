"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import {
    ChevronLeft,
    User,
    Bell,
    Mail,
    // Moon, // Removed
    // Sun, // Removed
    Shield,
    Key,
    Trash2,
    Save,
    Loader2,
    Settings,
    Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";
// import { useTheme } from "next-themes"; // Removed

export default function SettingsPage() {
    const router = useRouter();
    const { user, isLoading, logout, isInitialized } = useAuth();
    const { toast } = useToast();
    // const { theme, setTheme } = useTheme(); // Removed

    // Settings state
    const [pushNotifications, setPushNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [bookingReminders, setBookingReminders] = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    useEffect(() => {
        // Wait for auth to be initialized before redirecting
        if (!isInitialized) return;

        // Don't redirect while auth is still loading
        if (isLoading) return;

        if (!user) {
            router.push("/auth/login");
        }
    }, [user, isInitialized, isLoading, router]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await authApi.updatePreferences({
                emailNotifications: emailNotifications,
                smsNotifications: pushNotifications,
<<<<<<< HEAD
                bookingReminders: bookingReminders,
                weeklyDigest: weeklyDigest,
                theme: (theme as 'light' | 'dark' | 'system') || 'system',
=======
                // theme: (theme as 'light' | 'dark' | 'system') || 'system', // Removed
>>>>>>> 037ee58808f952e530e0f1885c242567d763b097
            });
            toast({
                title: "Settings Saved",
                description: "Your preferences have been updated successfully.",
            });
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : "Failed to save settings";
            toast({
                title: "Error",
                description: errMsg,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast({
                title: "Error",
                description: "New passwords do not match.",
                variant: "destructive",
            });
            return;
        }

        if (newPassword.length < 8) {
            toast({
                title: "Error",
                description: "Password must be at least 8 characters long.",
                variant: "destructive",
            });
            return;
        }

        setIsChangingPassword(true);
        try {
            await authApi.changePassword(currentPassword, newPassword);
            toast({
                title: "Password Changed",
                description: "Your password has been updated successfully.",
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : "Failed to change password";
            toast({
                title: "Error",
                description: errMsg,
                variant: "destructive",
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            await authApi.deleteAccount();
            toast({
                title: "Account Deleted",
                description: "Your account has been permanently deleted.",
            });
            await logout();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : "Failed to delete account";
            toast({
                title: "Error",
                description: errMsg,
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading settings...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <Button variant="ghost" onClick={() => router.push("/profile")}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Profile
                    </Button>
                    <h1 className="text-xl font-semibold">Settings</h1>
                    <ThemeToggle />
                </div>
            </header>

            <main className="container mx-auto max-w-3xl px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    {/* Appearance */}
<<<<<<< HEAD
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="h-5 w-5" />
                                Appearance
                            </CardTitle>
                            <CardDescription>
                                Customize how the app looks and feels
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        {theme === "dark" ? (
                                            <Moon className="h-4 w-4 text-primary" />
                                        ) : (
                                            <Sun className="h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <Label className="font-medium">Theme</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Choose your preferred color scheme
                                        </p>
                                    </div>
                                </div>
                                <Select value={theme} onValueChange={setTheme}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
=======
                    {/* Appearance Section Removed */}
>>>>>>> 037ee58808f952e530e0f1885c242567d763b097

                    {/* Notifications */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Notifications
                            </CardTitle>
                            <CardDescription>
                                Manage how you receive notifications
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <Bell className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <Label className="font-medium">Push Notifications</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Receive push notifications for updates
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={pushNotifications}
                                    onCheckedChange={setPushNotifications}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <Mail className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <Label className="font-medium">Email Notifications</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Receive booking confirmations via email
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={emailNotifications}
                                    onCheckedChange={setEmailNotifications}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <Bell className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <Label className="font-medium">Booking Reminders</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Get reminded before your bookings
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={bookingReminders}
                                    onCheckedChange={setBookingReminders}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <Mail className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <Label className="font-medium">Weekly Digest</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Receive a weekly summary of your bookings
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={weeklyDigest}
                                    onCheckedChange={setWeeklyDigest}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Security
                            </CardTitle>
                            <CardDescription>
                                Manage your account security settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="current-password">Current Password</Label>
                                    <Input
                                        id="current-password"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Enter current password"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                    />
                                </div>
                                <Button
                                    onClick={handleChangePassword}
                                    disabled={isChangingPassword || !currentPassword || !newPassword}
                                >
                                    {isChangingPassword && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    <Key className="mr-2 h-4 w-4" />
                                    Change Password
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    <Button
                        size="lg"
                        className="w-full"
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                    >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save All Settings
                    </Button>

                    {/* Danger Zone */}
                    <Card className="border-destructive/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <Trash2 className="h-5 w-5" />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>
                                Irreversible and destructive actions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Account
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete your
                                            account and remove all your data from our servers.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteAccount}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Delete Account
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </motion.div>
            </main>
        </div>
    );
}
