"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    Mail,
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    Loader2,
    KeyRound,
    ArrowLeft,
    CheckCircle2,
    ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { authApi } from "@/lib/api";

type ResetStep = "email" | "otp" | "new-password" | "success";

export function ForgotPasswordForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<ResetStep>("email");

    // Email step state
    const [email, setEmail] = useState("");

    // OTP step state
    const [sessionId, setSessionId] = useState("");
    const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Password step state
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Step 1: Request OTP
    const onSubmitEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !email.includes("@")) {
            setError("Please enter a valid email address");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await authApi.forgotPassword(email);
            const result = response.data.data;
            setSessionId(result.sessionId);
            setStep("otp");
            setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to send reset code"
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify OTP
    const onSubmitOtp = async (directOtpCode?: string) => {
        const otpCode = directOtpCode || otp.join("");
        if (otpCode.length !== 6) {
            setError("Please enter all 6 digits");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await authApi.verifyResetOtp(sessionId, otpCode);
            const result = response.data.data;
            setResetToken(result.resetToken);
            setStep("new-password");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Invalid or expired code"
            );
            setOtp(["", "", "", "", "", ""]);
            otpInputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Reset password
    const onSubmitNewPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await authApi.resetPassword(resetToken, newPassword, confirmPassword);
            setStep("success");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to reset password"
            );
        } finally {
            setIsLoading(false);
        }
    };

    // OTP input handlers (same as LoginForm)
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }

        const completedCode = newOtp.join("");
        if (newOtp.every((d) => d !== "") && completedCode.length === 6) {
            setTimeout(() => onSubmitOtp(completedCode), 100);
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").slice(0, 6);
        if (!/^\d+$/.test(pastedData)) return;

        const newOtp = [...otp];
        for (let i = 0; i < pastedData.length; i++) {
            newOtp[i] = pastedData[i];
        }
        setOtp(newOtp);

        if (pastedData.length === 6) {
            setTimeout(() => onSubmitOtp(pastedData), 100);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="w-full max-w-md">
                <AnimatePresence mode="wait">
                    {/* ============ STEP 1: EMAIL ============ */}
                    {step === "email" && (
                        <motion.div
                            key="email"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <CardHeader className="space-y-1">
                                <Link
                                    href="/auth/login"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to login
                                </Link>
                                <CardTitle className="text-2xl font-bold text-center">
                                    Forgot Password
                                </CardTitle>
                                <CardDescription className="text-center">
                                    Enter your email and we&apos;ll send you a verification code
                                </CardDescription>
                            </CardHeader>

                            <form onSubmit={onSubmitEmail}>
                                <CardContent className="space-y-4">
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                                        >
                                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="reset-email">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="reset-email"
                                                type="email"
                                                placeholder="your.email@university.edu"
                                                className="pl-10"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="flex flex-col space-y-4">
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sending code...
                                            </>
                                        ) : (
                                            "Send Reset Code"
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </motion.div>
                    )}

                    {/* ============ STEP 2: OTP ============ */}
                    {step === "otp" && (
                        <motion.div
                            key="otp"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <CardHeader className="space-y-1">
                                <button
                                    onClick={() => {
                                        setStep("email");
                                        setOtp(["", "", "", "", "", ""]);
                                        setError(null);
                                    }}
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </button>
                                <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                                    <KeyRound className="h-6 w-6 text-primary" />
                                    Verify Your Email
                                </CardTitle>
                                <CardDescription className="text-center">
                                    We&apos;ve sent a 6-digit code to
                                    <br />
                                    <span className="font-medium text-foreground">{email}</span>
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                                    >
                                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                        {error}
                                    </motion.div>
                                )}

                                <div className="flex justify-center gap-2">
                                    {otp.map((digit, index) => (
                                        <Input
                                            key={index}
                                            ref={(el) => {
                                                otpInputRefs.current[index] = el;
                                            }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) =>
                                                handleOtpChange(index, e.target.value)
                                            }
                                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                            onPaste={index === 0 ? handleOtpPaste : undefined}
                                            className="w-12 h-14 text-center text-2xl font-bold"
                                            disabled={isLoading}
                                        />
                                    ))}
                                </div>

                                <p className="text-center text-sm text-muted-foreground">
                                    The code expires in 5 minutes
                                </p>
                            </CardContent>

                            <CardFooter className="flex flex-col space-y-4">
                                <Button
                                    onClick={() => onSubmitOtp()}
                                    className="w-full"
                                    disabled={isLoading || otp.some((d) => !d)}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        "Verify Code"
                                    )}
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setOtp(["", "", "", "", "", ""]);
                                        setError(null);
                                        onSubmitEmail({ preventDefault: () => { } } as React.FormEvent);
                                    }}
                                    disabled={isLoading}
                                    className="text-sm text-primary hover:underline disabled:opacity-50"
                                >
                                    Didn&apos;t receive the code? Resend
                                </button>
                            </CardFooter>
                        </motion.div>
                    )}

                    {/* ============ STEP 3: NEW PASSWORD ============ */}
                    {step === "new-password" && (
                        <motion.div
                            key="new-password"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                                    <ShieldCheck className="h-6 w-6 text-primary" />
                                    Set New Password
                                </CardTitle>
                                <CardDescription className="text-center">
                                    Choose a strong password for your account
                                </CardDescription>
                            </CardHeader>

                            <form onSubmit={onSubmitNewPassword}>
                                <CardContent className="space-y-4">
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                                        >
                                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="new-password">New Password</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="new-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="pl-10 pr-10"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                minLength={8}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Must be at least 8 characters
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-password">Confirm Password</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="confirm-password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="pl-10 pr-10"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                minLength={8}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowConfirmPassword(!showConfirmPassword)
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Resetting password...
                                            </>
                                        ) : (
                                            "Reset Password"
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </motion.div>
                    )}

                    {/* ============ STEP 4: SUCCESS ============ */}
                    {step === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <CardHeader className="space-y-1">
                                <div className="flex justify-center mb-4">
                                    <div className="rounded-full bg-green-100 p-3">
                                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                                    </div>
                                </div>
                                <CardTitle className="text-2xl font-bold text-center">
                                    Password Reset!
                                </CardTitle>
                                <CardDescription className="text-center">
                                    Your password has been successfully reset. You can now sign in
                                    with your new password.
                                </CardDescription>
                            </CardHeader>

                            <CardFooter>
                                <Button
                                    className="w-full"
                                    onClick={() => router.push("/auth/login")}
                                >
                                    Go to Login
                                </Button>
                            </CardFooter>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
        </motion.div>
    );
}
