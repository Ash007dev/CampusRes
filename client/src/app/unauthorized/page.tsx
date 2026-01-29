"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldOff, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
    const router = useRouter();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="w-full max-w-md text-center">
                    <CardHeader className="pb-4">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                            <ShieldOff className="h-10 w-10 text-destructive" />
                        </div>
                        <CardTitle className="text-2xl">Access Denied</CardTitle>
                        <CardDescription>
                            You don't have permission to access this page.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            This page requires elevated privileges. If you believe this is an
                            error, please contact your administrator.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <Button variant="outline" onClick={() => router.back()}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Go Back
                            </Button>
                            <Button onClick={() => router.push("/dashboard")}>
                                <Home className="mr-2 h-4 w-4" />
                                Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
