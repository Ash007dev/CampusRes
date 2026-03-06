"use client";

import { User as UserIcon, Mail, Shield, Building2, Calendar, Activity, X } from "lucide-react";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ViewUserDetailsModalProps {
    user: any | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ViewUserDetailsModal({
    user,
    isOpen,
    onClose,
}: ViewUserDetailsModalProps) {
    if (!user) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>User Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <UserIcon className="h-8 w-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">{user.name}</h3>
                            <p className="text-muted-foreground flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                {user.email}
                            </p>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Shield className="h-4 w-4" />
                                Role
                            </span>
                            <p className="font-medium">{user.role}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                Department
                            </span>
                            <p className="font-medium">{user.department || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Activity className="h-4 w-4" />
                                Status
                            </span>
                            <div>
                                <Badge
                                    variant="outline"
                                    className={
                                        user.status === "ACTIVE"
                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                            : user.status === "SUSPENDED"
                                                ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    }
                                >
                                    {user.status}
                                </Badge>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <span className="font-mono h-4 w-4 text-center">★</span>
                                Reputation
                            </span>
                            <p className="font-medium">{user.reputationScore}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Total Bookings
                            </span>
                            <p className="font-medium">{user.bookingsCount || 0}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <UserIcon className="h-4 w-4" />
                                Last Active
                            </span>
                            <p className="font-medium">
                                {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
