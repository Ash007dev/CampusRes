"use client";

import {
    useState,
    useEffect,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import {
    QrCode,
    CheckCircle,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { bookingsApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface QRScannerProps {
    bookingId: string;
    roomCode?: string;
    onSuccess?: () => void;
    onClose?: () => void;
    isOpen: boolean;
}

export function QRScanner({
    bookingId,
    roomCode,
    onSuccess,
    onClose,
    isOpen,
}: QRScannerProps) {
    const [qrUrl, setQrUrl] = useState("");
    const [status, setStatus] = useState<"waiting" | "success">("waiting");

    useEffect(() => {
        if (isOpen) {
            setStatus("waiting");
            // Generate URL with token for demo purposes
            const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
            const origin = typeof window !== 'undefined' ? window.location.origin : '';

            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                console.warn("[CHECK-IN DEMO] To scan this QR code with a mobile device, please access the site using your computer's local network IP address (e.g., http://192.168.1.5:3000) instead of localhost.");
            }

            const url = `${origin}/mobile-checkin?b=${bookingId}&c=${roomCode || ''}&t=${token || ''}`;
            setQrUrl(url);
        }
    }, [isOpen, bookingId, roomCode]);

    // Poll for booking status updates
    useEffect(() => {
        if (!isOpen || status === "success") return;

        let interval = setInterval(async () => {
            try {
                const response = await bookingsApi.getById(bookingId);
                const currentBooking = response.data?.data;
                if (currentBooking && currentBooking.checkInStatus === "CHECKED_IN") {
                    setStatus("success");
                    clearInterval(interval);
                    setTimeout(() => {
                        onSuccess?.();
                        onClose?.();
                    }, 2000);
                }
            } catch (err) {
                // Ignore API poll errors silently
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isOpen, bookingId, status, onSuccess, onClose]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <QrCode className="w-5 h-5 text-primary" />
                        Check In to Room {roomCode}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Scan this QR code with your phone's camera to complete check-in.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-6 pt-6 space-y-4 flex flex-col items-center justify-center">
                    <div className="relative p-4 bg-white rounded-xl shadow-inner border">
                        <AnimatePresence mode="wait">
                            {status === "waiting" ? (
                                <motion.div
                                    key="qr"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    {qrUrl ? (
                                        <QRCodeSVG value={qrUrl} size={240} level="M" />
                                    ) : (
                                        <div className="w-[240px] h-[240px] flex items-center justify-center bg-muted/20">
                                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="success"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="w-[240px] h-[240px] flex flex-col items-center justify-center bg-green-500/10 rounded-lg text-green-600 gap-3"
                                >
                                    <CheckCircle className="w-20 h-20" />
                                    <p className="font-bold text-center">Checked In Successfully!</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {status === "waiting" && (
                        <p className="text-sm text-muted-foreground text-center animate-pulse">
                            Waiting for phone scan...
                        </p>
                    )}

                    <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={onClose}
                    >
                        {status === "success" ? "Done" : "Cancel"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default QRScanner;
