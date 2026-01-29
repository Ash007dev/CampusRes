"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Camera,
    X,
    QrCode,
    CheckCircle,
    AlertCircle,
    Loader2,
    MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookingsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface QRScannerProps {
    bookingId: string;
    roomCode?: string;
    onSuccess?: () => void;
    onClose?: () => void;
    isOpen: boolean;
}

type ScanStatus = "idle" | "scanning" | "success" | "error";

export function QRScanner({
    bookingId,
    roomCode,
    onSuccess,
    onClose,
    isOpen,
}: QRScannerProps) {
    const { toast } = useToast();
    const [status, setStatus] = useState<ScanStatus>("idle");
    const [manualCode, setManualCode] = useState(roomCode || "");
    const [location, setLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [locationStatus, setLocationStatus] = useState<
        "pending" | "granted" | "denied"
    >("pending");

    // Get user location on mount
    useEffect(() => {
        if (isOpen && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                    setLocationStatus("granted");
                },
                () => {
                    setLocationStatus("denied");
                },
                { timeout: 5000 }
            );
        }
    }, [isOpen]);

    const handleCheckIn = useCallback(
        async (code: string) => {
            if (!code.trim()) {
                toast({
                    title: "Enter Code",
                    description: "Please enter the room code displayed at the entrance.",
                    variant: "destructive",
                });
                return;
            }

            setStatus("scanning");

            try {
                await bookingsApi.checkIn(
                    bookingId,
                    code,
                    location?.lat,
                    location?.lng
                );

                setStatus("success");
                toast({
                    title: "Check-in Successful! ✓",
                    description: "You have been checked in to your booking.",
                });

                // Call success callback after short delay
                setTimeout(() => {
                    onSuccess?.();
                }, 1500);
            } catch (error: any) {
                setStatus("error");
                toast({
                    title: "Check-in Failed",
                    description:
                        error.message || "Unable to check in. Please try again.",
                    variant: "destructive",
                });

                // Reset status after delay
                setTimeout(() => setStatus("idle"), 2000);
            }
        },
        [bookingId, location, toast, onSuccess]
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-primary" />
                        Check In to Booking
                    </DialogTitle>
                    <DialogDescription>
                        Enter the room code displayed on the door or scan the QR code
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Scan Status Animation */}
                    <div className="relative h-48 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center overflow-hidden">
                        <AnimatePresence mode="wait">
                            {status === "idle" && (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center"
                                >
                                    <Camera className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                        Camera-based QR scanning coming soon!
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        For now, enter the room code manually below
                                    </p>
                                </motion.div>
                            )}

                            {status === "scanning" && (
                                <motion.div
                                    key="scanning"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="text-center"
                                >
                                    <Loader2 className="w-12 h-12 mx-auto mb-2 text-primary animate-spin" />
                                    <p className="text-sm font-medium">Checking in...</p>
                                </motion.div>
                            )}

                            {status === "success" && (
                                <motion.div
                                    key="success"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                    className="text-center"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: [0, 1.2, 1] }}
                                        transition={{ duration: 0.4 }}
                                    >
                                        <CheckCircle className="w-16 h-16 mx-auto mb-2 text-green-500" />
                                    </motion.div>
                                    <p className="text-lg font-semibold text-green-600">
                                        Check-in Successful!
                                    </p>
                                </motion.div>
                            )}

                            {status === "error" && (
                                <motion.div
                                    key="error"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="text-center"
                                >
                                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
                                    <p className="text-sm font-medium text-red-600">
                                        Check-in Failed
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Please try again
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Location Status */}
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin
                            className={`w-4 h-4 ${locationStatus === "granted" ? "text-green-500" : "text-muted-foreground"}`}
                        />
                        <span className="text-muted-foreground">
                            {locationStatus === "pending" && "Getting location..."}
                            {locationStatus === "granted" && "Location enabled for proximity check"}
                            {locationStatus === "denied" && "Location disabled (optional)"}
                        </span>
                    </div>

                    {/* Manual Code Input */}
                    <div className="space-y-2">
                        <Label htmlFor="roomCode">Room Code</Label>
                        <div className="flex gap-2">
                            <Input
                                id="roomCode"
                                placeholder="Enter room code (e.g., LB-101)"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                disabled={status === "scanning" || status === "success"}
                                className="font-mono text-lg"
                            />
                            <Button
                                onClick={() => handleCheckIn(manualCode)}
                                disabled={status === "scanning" || status === "success"}
                                className="min-w-[100px]"
                            >
                                {status === "scanning" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Check In"
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Close Button */}
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={onClose}
                        disabled={status === "scanning"}
                    >
                        {status === "success" ? "Done" : "Cancel"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default QRScanner;
