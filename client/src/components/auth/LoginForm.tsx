"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api";

// Validation schema for login
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

type LoginStep = "credentials" | "otp";

export function LoginForm({ onSuccess, redirectTo = "/dashboard" }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MFA State
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [mfaData, setMfaData] = useState<{
    userId: string;
    email: string;
    userName: string;
  } | null>(null);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ALWAYS clear existing session when login page loads
  useEffect(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax";
    window.dispatchEvent(new Event("storage"));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Step 1: Submit credentials
  const onSubmitCredentials = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(data.email, data.password);
      const result = response.data.data;

      if (result.requiresOtp) {
        // Move to OTP step
        setMfaData({
          userId: result.userId,
          email: result.email,
          userName: result.userName,
        });
        setLoginStep("otp");
        // Focus first OTP input
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const onSubmitOtp = async () => {
    if (!mfaData) return;

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.verifyOtp(mfaData.userId, otpCode);
      const { user: apiUser, tokens } = response.data.data;

      // Map the user data properly
      const userData = {
        id: apiUser.id,
        name: `${apiUser.firstName} ${apiUser.lastName}`,
        email: apiUser.email,
        role: apiUser.role,
        departmentId: apiUser.departmentId || undefined,
        departmentName: (apiUser as any).departmentName || undefined,
        reputationScore: apiUser.reputationScore || 0,
      };

      // Store token and user data
      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("user", JSON.stringify(userData));
      document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

      console.log("[Login] User authenticated with MFA:", userData);

      onSuccess?.();
      router.push(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid or expired OTP"
      );
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only keep last digit
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newOtp.every(d => d !== "") && newOtp.join("").length === 6) {
      setTimeout(() => onSubmitOtp(), 100);
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
      setTimeout(() => onSubmitOtp(), 100);
    }
  };

  const goBackToCredentials = () => {
    setLoginStep("credentials");
    setMfaData(null);
    setOtp(["", "", "", "", "", ""]);
    setError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {loginStep === "credentials" ? (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-center">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-center">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmit(onSubmitCredentials)}>
                <CardContent className="space-y-4">
                  {/* Error Alert */}
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

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@university.edu"
                        className="pl-10"
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        {...register("password")}
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
                    {errors.password && (
                      <p className="text-sm text-destructive">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col space-y-4">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link
                      href="/auth/register"
                      className="font-medium text-primary hover:underline"
                    >
                      Sign up
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <CardHeader className="space-y-1">
                <button
                  onClick={goBackToCredentials}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                  <KeyRound className="h-6 w-6 text-primary" />
                  Verify Your Identity
                </CardTitle>
                <CardDescription className="text-center">
                  We&apos;ve sent a 6-digit code to<br />
                  <span className="font-medium text-foreground">{mfaData?.email}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Error Alert */}
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

                {/* OTP Input */}
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => { otpInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
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
                  onClick={onSubmitOtp}
                  className="w-full"
                  disabled={isLoading || otp.some(d => !d)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Sign In"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    // Resend OTP by re-submitting credentials
                    const { email, password } = getValues();
                    onSubmitCredentials({ email, password });
                  }}
                  disabled={isLoading}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  Didn&apos;t receive the code? Resend
                </button>
              </CardFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export type { LoginFormProps, LoginFormData };
