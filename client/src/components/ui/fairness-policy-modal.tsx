"use client";

/**
 * =============================================================================
 * Fairness Policy Modal (US 4.10)
 * =============================================================================
 * Displays booking rules and usage policies to help users understand
 * why they might be blocked or limited in their bookings
 * =============================================================================
 */

import * as React from "react";
import {
    AlertCircle,
    Clock,
    Users,
    Shield,
    Ban,
    CheckCircle,
    HelpCircle,
    X,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PolicyRule {
    icon: React.ElementType;
    title: string;
    description: string;
    badge?: string;
    badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

const BOOKING_RULES: PolicyRule[] = [
    {
        icon: Clock,
        title: "Weekly Quota",
        description: "Students can book up to 4 hours per week. Faculty members have unlimited access.",
        badge: "4h/week",
        badgeVariant: "secondary",
    },
    {
        icon: CheckCircle,
        title: "Check-in Required",
        description: "You must check in within 15 minutes of your booking start time using the QR code at the room.",
        badge: "15 min",
        badgeVariant: "outline",
    },
    {
        icon: Ban,
        title: "No-Show Penalty",
        description: "Missing 3 check-ins will result in a 7-day booking suspension. Your reputation score also decreases.",
        badge: "3 strikes",
        badgeVariant: "destructive",
    },
    {
        icon: Clock,
        title: "Booking Duration",
        description: "Minimum booking is 30 minutes, maximum is 4 hours per session.",
        badge: "30m-4h",
        badgeVariant: "secondary",
    },
    {
        icon: Users,
        title: "Department Priority",
        description: "Department rooms have priority access for their members. Cross-department booking is allowed after 6 PM.",
        badge: "After 6PM",
        badgeVariant: "outline",
    },
    {
        icon: Shield,
        title: "Approval Required",
        description: "Auditoriums and conference halls require admin approval. Your request will be reviewed within 24 hours.",
        badge: "24h review",
        badgeVariant: "secondary",
    },
];

const CREDITS_INFO = [
    { label: "Standard booking", value: "10 credits/hour" },
    { label: "Peak hours (9AM-5PM)", value: "20 credits/hour" },
    { label: "Early checkout", value: "Partial refund" },
    { label: "Cancellation", value: "Full refund" },
];

interface FairnessPolicyModalProps {
    children?: React.ReactNode;
    trigger?: React.ReactNode;
    quotaUsed?: number;
    quotaLimit?: number;
    reputationScore?: number;
    noShowCount?: number;
}

export function FairnessPolicyModal({
    children,
    trigger,
    quotaUsed = 0,
    quotaLimit = 4,
    reputationScore = 100,
    noShowCount = 0,
}: FairnessPolicyModalProps) {
    const quotaPercentage = Math.min(100, (quotaUsed / quotaLimit) * 100);

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Booking Rules
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Booking Rules & Fair Usage Policy
                    </DialogTitle>
                    <DialogDescription>
                        Understanding these rules helps ensure fair access for everyone on campus.
                    </DialogDescription>
                </DialogHeader>

                {/* Current Status */}
                <div className="grid grid-cols-3 gap-4 my-4">
                    <Card>
                        <CardContent className="pt-4 text-center">
                            <div className="text-2xl font-bold">
                                {quotaUsed.toFixed(1)}/{quotaLimit}h
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Weekly Quota</p>
                            <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                    className={`h-full transition-all ${
                                        quotaPercentage > 80 ? 'bg-destructive' : 'bg-primary'
                                    }`}
                                    style={{ width: `${quotaPercentage}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 text-center">
                            <div className="text-2xl font-bold">{reputationScore}</div>
                            <p className="text-xs text-muted-foreground mt-1">Reputation</p>
                            <Badge variant={reputationScore > 80 ? "default" : "destructive"} className="mt-2">
                                {reputationScore > 80 ? "Good Standing" : "At Risk"}
                            </Badge>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 text-center">
                            <div className="text-2xl font-bold">{noShowCount}/3</div>
                            <p className="text-xs text-muted-foreground mt-1">No-Shows</p>
                            <Badge variant={noShowCount >= 2 ? "destructive" : "outline"} className="mt-2">
                                {noShowCount >= 2 ? "Warning" : "Clean Record"}
                            </Badge>
                        </CardContent>
                    </Card>
                </div>

                <Separator />

                {/* Rules */}
                <div className="space-y-4 my-4">
                    <h3 className="font-semibold">Booking Rules</h3>
                    {BOOKING_RULES.map((rule, index) => {
                        const Icon = rule.icon;
                        return (
                            <div key={index} className="flex gap-4 items-start">
                                <div className="rounded-lg bg-primary/10 p-2">
                                    <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{rule.title}</span>
                                        {rule.badge && (
                                            <Badge variant={rule.badgeVariant || "secondary"}>
                                                {rule.badge}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {rule.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <Separator />

                {/* Credits Info */}
                <div className="space-y-3 my-4">
                    <h3 className="font-semibold">Credit System</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {CREDITS_INFO.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm p-2 rounded-lg bg-muted/50">
                                <span className="text-muted-foreground">{item.label}</span>
                                <span className="font-medium">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Tips */}
                <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Tips for Good Standing
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Always check in using the QR code when you arrive</li>
                        <li>• Cancel bookings you can&apos;t attend at least 1 hour in advance</li>
                        <li>• Use early checkout to return unused time and credits</li>
                        <li>• Book only what you need to save your weekly quota</li>
                    </ul>
                </div>

                {children}
            </DialogContent>
        </Dialog>
    );
}

export default FairnessPolicyModal;
