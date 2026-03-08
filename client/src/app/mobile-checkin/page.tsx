"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, QrCode } from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

function MobileCheckInContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    // b = bookingId, c = qrCode, t = token
    const bookingId = searchParams.get('b');
    const roomCode = searchParams.get('c');
    const token = searchParams.get('t');

    const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied">("pending");

    // Initialize location
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationStatus("denied");
            return;
        }
        setLocationStatus("pending");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationStatus("granted");
            },
            () => {
                setLocationStatus("denied");
                setLocation(null);
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    }, []);

    // Also inject token to localStorage automatically
    useEffect(() => {
        if (token) {
            localStorage.setItem('accessToken', token);
        }
    }, [token]);

    const handleCheckIn = async () => {
        if (!bookingId || !roomCode) {
            setErrorMessage("Invalid check-in link. Missing booking or room code.");
            setStatus("error");
            return;
        }

        setStatus("scanning");
        setErrorMessage("");

        try {
            await bookingsApi.checkIn(bookingId, roomCode, location?.lat, location?.lng);
            setStatus("success");
            toast({
                title: "Check-in Successful! ✓",
                description: "You have been checked in. You may close this page.",
            });
        } catch (error: any) {
            const msg = error?.message || error?.error?.message || "Unable to check in. Please try again.";
            setStatus("error");
            setErrorMessage(msg);
            toast({
                title: "Check-in Failed",
                description: msg,
                variant: "destructive",
            });
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
                <div className="p-4 bg-primary/10 rounded-full">
                    <QrCode className="w-12 h-12 text-primary" />
                </div>

                <h1 className="text-2xl font-bold">Mobile Check-In</h1>

                {status === "idle" && (
                    <div className="space-y-4 w-full">
                        <p className="text-muted-foreground">
                            You are checking into room <strong>{roomCode}</strong>.
                            {locationStatus === "pending" && <span className="block text-xs mt-2 text-yellow-600 animate-pulse">Acquiring GPS location...</span>}
                            {locationStatus === "granted" && <span className="block text-xs mt-2 text-green-600">Location verified ✓</span>}
                            {locationStatus === "denied" && <span className="block text-xs mt-2 text-red-500">Location denied. You must be on campus.</span>}
                        </p>

                        <Button
                            className="w-full text-lg py-6"
                            onClick={handleCheckIn}
                            disabled={locationStatus === "pending"}
                        >
                            Confirm Check-In
                        </Button>
                    </div>
                )}

                {status === "scanning" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p>Processing check-in...</p>
                    </motion.div>
                )}

                {status === "success" && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-4 text-green-600"
                    >
                        <CheckCircle className="w-16 h-16" />
                        <h2 className="text-xl font-bold mt-2">Checked In!</h2>
                        <p className="text-sm text-foreground mt-4 text-center">
                            You're all set. The desktop view will update shortly. You can close this window now.
                        </p>
                    </motion.div>
                )}

                {status === "error" && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <AlertCircle className="w-16 h-16 text-red-500" />
                        <h2 className="text-xl font-bold mt-2 text-red-500">Check-In Failed</h2>
                        <p className="text-sm text-balance">{errorMessage}</p>
                        <Button variant="outline" className="mt-4" onClick={() => setStatus("idle")}>
                            Try Again
                        </Button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

export default function MobileCheckInPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <MobileCheckInContent />
        </Suspense>
    );
}
