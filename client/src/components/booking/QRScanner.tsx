"use client";

/**
 * =============================================================================
 * QRScanner — US 3.1 QR Code Check-In  +  US 3.9 GPS Location Verification
 * =============================================================================
 *
 * Modes
 * ─────
 *  • Camera mode  — live <video> feed scanned every 200ms with jsQR.
 *                   Animates a laser-sweep line over a corner-bracket viewfinder.
 *                   Auto-submits the moment a QR code is detected.
 *  • Manual mode  — fallback text input for the room code.
 *
 * GPS
 * ───
 *  Acquired on dialog open.  Coordinates are sent with the check-in request.
 *  Server enforces the 50 m campus radius (CHECKIN_4004).
 *
 * Scan status machine
 * ───────────────────
 *  idle         → camera warming up / manual entry ready
 *  camera_ready → feed live, scanning loop running
 *  qr_found     → code detected, auto-submitting
 *  scanning     → API call in flight
 *  success      → checked in OK
 *  error        → generic server/network error
 *  out_of_range → CHECKIN_4004 — too far from venue
 * =============================================================================
 */

import {
    useState,
    useCallback,
    useEffect,
    useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    QrCode,
    CheckCircle,
    AlertCircle,
    Loader2,
    MapPin,
    Navigation,
    Camera,
    Keyboard,
    RefreshCw,
    ScanLine,
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

// jsQR is a CommonJS module — load only client-side
type JsQR = (
    data: Uint8ClampedArray,
    width: number,
    height: number
) => { data: string } | null;

// ─────────────────────────────── types ──────────────────────────────────────

interface QRScannerProps {
    bookingId: string;
    roomCode?: string;
    onSuccess?: () => void;
    onClose?: () => void;
    isOpen: boolean;
}

type ScanStatus =
    | "idle"
    | "camera_ready"
    | "qr_found"
    | "scanning"
    | "success"
    | "error"
    | "out_of_range";

type Mode = "camera" | "manual";

// ──────────────────────────────── helpers ────────────────────────────────────

/** Load jsQR lazily (avoids SSR issues) */
async function loadJsQR(): Promise<JsQR> {
    const mod = await import("jsqr");
    return (mod.default ?? mod) as unknown as JsQR;
}

// ──────────────────────────── component ─────────────────────────────────────

export function QRScanner({
    bookingId,
    roomCode,
    onSuccess,
    onClose,
    isOpen,
}: QRScannerProps) {
    const { toast } = useToast();

    // ── state ────────────────────────────────────────────────────────────────
    const [mode, setMode] = useState<Mode>("camera");
    const [status, setStatus] = useState<ScanStatus>("idle");
    const [manualCode, setManualCode] = useState(roomCode || "");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [scannedCode, setScannedCode] = useState<string>("");
    const [camError, setCamError] = useState<string>("");

    const [location, setLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [locationStatus, setLocationStatus] = useState<
        "pending" | "granted" | "denied"
    >("pending");

    // ── refs ─────────────────────────────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const jsQRRef = useRef<JsQR | null>(null);

    // ── GPS: acquire once on open ────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
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
    }, [isOpen]);

    // ── Reset on open ────────────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setStatus("idle");
            setErrorMessage("");
            setScannedCode("");
            setCamError("");
            setManualCode(roomCode || "");
            setMode("camera");
        }
    }, [isOpen, roomCode]);

    // ── Stop camera when closed ───────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) stopCamera();
    }, [isOpen]);

    // ── Start camera when mode switches to camera and dialog is open ──────────
    useEffect(() => {
        if (isOpen && mode === "camera") {
            startCamera();
        } else {
            stopCamera();
        }
        return stopCamera;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mode]);

    // ─────────────────────────────────────────────────────────────────────────
    function stopCamera() {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function startCamera() {
        setCamError("");
        stopCamera();

        // Prefer back camera on mobile
        const constraints: MediaStreamConstraints = {
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 640 },
                height: { ideal: 480 },
            },
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Load jsQR lazily
            if (!jsQRRef.current) {
                jsQRRef.current = await loadJsQR();
            }

            setStatus("camera_ready");
            scanLoop();
        } catch (err: any) {
            const msg =
                err?.name === "NotAllowedError"
                    ? "Camera permission denied. Please allow access or use manual entry below."
                    : err?.name === "NotFoundError"
                        ? "No camera found on this device."
                        : "Could not start camera. Try manual entry below.";
            setCamError(msg);
            setMode("manual");
        }
    }

    // ── QR scan loop (every animation frame, sample every ~200ms) ────────────
    function scanLoop() {
        let lastScan = 0;

        function tick() {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const jsQR = jsQRRef.current;

            if (!video || !canvas || !jsQR || !streamRef.current) return;
            if (video.readyState !== video.HAVE_ENOUGH_DATA) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            const now = performance.now();
            if (now - lastScan < 200) {
                // Skip frame — throttle to ~5 fps for QR decode
                rafRef.current = requestAnimationFrame(tick);
                return;
            }
            lastScan = now;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(imageData.data, imageData.width, imageData.height);

            if (result?.data) {
                // QR found! Stop loop and submit
                const decoded = result.data.trim().toUpperCase();
                setScannedCode(decoded);
                setStatus("qr_found");
                stopCamera();
                handleCheckIn(decoded);
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
    }

    // ── Check-in API call ─────────────────────────────────────────────────────
    const handleCheckIn = useCallback(
        async (code: string) => {
            const trimmed = code.trim();
            if (!trimmed) {
                toast({
                    title: "Enter Code",
                    description:
                        "Please enter the room code displayed at the entrance.",
                    variant: "destructive",
                });
                return;
            }

            setStatus("scanning");
            setErrorMessage("");

            try {
                await bookingsApi.checkIn(
                    bookingId,
                    trimmed,
                    location?.lat,
                    location?.lng
                );

                setStatus("success");
                toast({
                    title: "Check-in Successful! ✓",
                    description: "You have been checked in to your booking.",
                });
                setTimeout(() => onSuccess?.(), 1500);
            } catch (error: any) {
                const errCode =
                    error?.code || error?.error?.code || "";
                const msg: string =
                    error?.message ||
                    error?.error?.message ||
                    "Unable to check in. Please try again.";

                if (
                    errCode === "CHECKIN_4004" ||
                    msg.toLowerCase().includes("too far") ||
                    msg.toLowerCase().includes("location")
                ) {
                    setStatus("out_of_range");
                    setErrorMessage(msg);
                } else {
                    setStatus("error");
                    setErrorMessage(msg);
                    toast({
                        title: "Check-in Failed",
                        description: msg,
                        variant: "destructive",
                    });
                }

                setTimeout(() => setStatus(mode === "camera" ? "camera_ready" : "idle"), 4000);
            }
        },
        [bookingId, location, mode, toast, onSuccess]
    );

    // ── derived ───────────────────────────────────────────────────────────────
    const isProcessing =
        status === "scanning" || status === "success" || status === "qr_found";

    // ─────────────────────────────────────────────────────── UI ──────────────
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl">
                {/* ── Header ───────────────────────────────────────────────── */}
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <QrCode className="w-5 h-5 text-primary" />
                        Check In to Booking
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        {mode === "camera"
                            ? "Point your camera at the QR code on the room door"
                            : "Enter the room code shown on the door"}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-6 pt-4 space-y-4">
                    {/* ── Mode toggle ────────────────────────────────────────── */}
                    <div className="flex gap-2">
                        <Button
                            variant={mode === "camera" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 gap-1.5"
                            onClick={() => setMode("camera")}
                            disabled={isProcessing}
                        >
                            <Camera className="w-4 h-4" />
                            Camera Scan
                        </Button>
                        <Button
                            variant={mode === "manual" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 gap-1.5"
                            onClick={() => setMode("manual")}
                            disabled={isProcessing}
                        >
                            <Keyboard className="w-4 h-4" />
                            Enter Code
                        </Button>
                    </div>

                    {/* ── Main viewport ──────────────────────────────────────── */}
                    <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: 280 }}>

                        {/* Live video feed (always rendered so stream can attach) */}
                        <video
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ display: mode === "camera" && (status === "camera_ready" || status === "qr_found") ? "block" : "none" }}
                            muted
                            playsInline
                        />
                        {/* Off-screen canvas for jsQR frame capture */}
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Corner-bracket viewfinder overlay */}
                        {mode === "camera" && (status === "camera_ready") && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                {/* Darkened border mask */}
                                <div className="absolute inset-0 bg-black/40" />

                                {/* Clear scan box */}
                                <div className="relative w-52 h-52">
                                    {/* 4 corner brackets */}
                                    {[
                                        "top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
                                        "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
                                        "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
                                        "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl",
                                    ].map((cls, i) => (
                                        <div
                                            key={i}
                                            className={`absolute w-8 h-8 border-primary ${cls}`}
                                        />
                                    ))}

                                    {/* Laser sweep animation */}
                                    <motion.div
                                        className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                                        animate={{ top: ["0%", "100%", "0%"] }}
                                        transition={{
                                            duration: 2.2,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                        }}
                                    />
                                </div>

                                {/* Scanning label */}
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                    <span className="text-white text-xs bg-black/60 px-3 py-1 rounded-full flex items-center gap-1.5">
                                        <ScanLine className="w-3 h-3" />
                                        Scanning…
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* ── Overlay states ─────────────────────────────────── */}
                        <AnimatePresence mode="wait">
                            {/* Idle / camera loading */}
                            {mode === "camera" && status === "idle" && (
                                <motion.div
                                    key="cam-idle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black"
                                >
                                    <Loader2 className="w-10 h-10 animate-spin opacity-60" />
                                    <p className="text-sm opacity-70">Starting camera…</p>
                                </motion.div>
                            )}

                            {/* Manual mode overlay */}
                            {mode === "manual" && (
                                <motion.div
                                    key="manual-overlay"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30 backdrop-blur-sm gap-3 px-6"
                                >
                                    <div className="bg-background border rounded-2xl p-5 shadow-lg w-full space-y-3">
                                        <Label
                                            htmlFor="roomCode"
                                            className="text-sm font-medium"
                                        >
                                            Room Code
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="roomCode"
                                                placeholder="e.g. LB-101"
                                                value={manualCode}
                                                onChange={(e) =>
                                                    setManualCode(
                                                        e.target.value.toUpperCase()
                                                    )
                                                }
                                                disabled={isProcessing}
                                                className="font-mono text-lg tracking-widest"
                                                onKeyDown={(e) =>
                                                    e.key === "Enter" &&
                                                    handleCheckIn(manualCode)
                                                }
                                                autoFocus
                                            />
                                            <Button
                                                id="checkInBtn"
                                                onClick={() =>
                                                    handleCheckIn(manualCode)
                                                }
                                                disabled={isProcessing}
                                                className="min-w-[88px]"
                                            >
                                                {status === "scanning" ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    "Check In"
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Find the code on the QR sticker by the door
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* QR code found flash */}
                            {status === "qr_found" && (
                                <motion.div
                                    key="qr-found"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-primary/90 gap-2"
                                >
                                    <QrCode className="w-12 h-12 text-white" />
                                    <p className="text-white font-semibold">QR Code detected!</p>
                                    <p className="text-white/70 text-sm font-mono">{scannedCode}</p>
                                    <Loader2 className="w-5 h-5 text-white animate-spin mt-1" />
                                </motion.div>
                            )}

                            {/* Submitting */}
                            {status === "scanning" && mode === "camera" && (
                                <motion.div
                                    key="cam-scanning"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3"
                                >
                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                    <p className="text-white text-sm">Checking in…</p>
                                </motion.div>
                            )}

                            {/* Success */}
                            {status === "success" && (
                                <motion.div
                                    key="success"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/90 gap-2"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: [0, 1.3, 1] }}
                                        transition={{ duration: 0.45 }}
                                    >
                                        <CheckCircle className="w-20 h-20 text-white" />
                                    </motion.div>
                                    <p className="text-white text-xl font-bold">
                                        Checked In!
                                    </p>
                                </motion.div>
                            )}

                            {/* Generic error */}
                            {status === "error" && (
                                <motion.div
                                    key="error"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 px-6"
                                >
                                    <AlertCircle className="w-12 h-12 text-red-400" />
                                    <p className="text-white font-semibold">
                                        Check-in Failed
                                    </p>
                                    <p className="text-white/60 text-xs text-center">
                                        {errorMessage || "Please try again"}
                                    </p>
                                </motion.div>
                            )}

                            {/* Out of range (US 3.9) */}
                            {status === "out_of_range" && (
                                <motion.div
                                    key="out_of_range"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-orange-500/90 gap-2 px-6"
                                >
                                    <motion.div
                                        animate={{ rotate: [0, -12, 12, -12, 12, 0] }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <Navigation className="w-14 h-14 text-white" />
                                    </motion.div>
                                    <p className="text-white text-lg font-bold">
                                        Location Mismatch
                                    </p>
                                    <p className="text-white/80 text-xs text-center leading-snug">
                                        {errorMessage ||
                                            "You are too far from the venue to check in."}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ── Camera error notice ────────────────────────────────── */}
                    {camError && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2 text-yellow-700 dark:text-yellow-400"
                        >
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p className="text-xs leading-snug">{camError}</p>
                        </motion.div>
                    )}

                    {/* ── Camera retry when in manual mode ──────────────────── */}
                    {mode === "manual" && !camError && (
                        <button
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                            onClick={() => setMode("camera")}
                            disabled={isProcessing}
                        >
                            Try camera scan instead
                        </button>
                    )}
                    {mode === "camera" && camError && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5"
                            onClick={() => { setCamError(""); startCamera(); }}
                            disabled={isProcessing}
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry Camera
                        </Button>
                    )}

                    {/* ── GPS status banner ──────────────────────────────────── */}
                    <div
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${locationStatus === "granted"
                                ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                                : locationStatus === "denied"
                                    ? "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"
                                    : "bg-muted text-muted-foreground"
                            }`}
                    >
                        <MapPin
                            className={`w-4 h-4 flex-shrink-0 ${locationStatus === "granted"
                                    ? "text-green-500"
                                    : locationStatus === "denied"
                                        ? "text-yellow-500"
                                        : ""
                                }`}
                        />
                        <span>
                            {locationStatus === "pending" &&
                                "Getting your location…"}
                            {locationStatus === "granted" &&
                                "Location enabled — proximity will be verified"}
                            {locationStatus === "denied" &&
                                "Location denied — you must be physically at the venue"}
                        </span>
                    </div>

                    {/* ── Close / Done ───────────────────────────────────────── */}
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={onClose}
                        disabled={status === "scanning" || status === "qr_found"}
                    >
                        {status === "success" ? "Done ✓" : "Cancel"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default QRScanner;
