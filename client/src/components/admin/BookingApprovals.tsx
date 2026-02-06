"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
    CheckCircle,
    XCircle,
    Clock,
    Eye,
    MessageSquare,
    AlertCircle
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function BookingApprovals() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rejectionReason, setRejectionReason] = useState("");
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const { toast } = useToast();

    const fetchPendingApprovals = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await adminApi.getPendingApprovals();
            setBookings(response.data.data || []);
        } catch (error) {
            console.error("Failed to fetch approvals:", error);
            toast({
                title: "Error",
                description: "Failed to load pending approvals",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchPendingApprovals();
    }, [fetchPendingApprovals]);

    const handleApprove = async (id: string) => {
        try {
            await adminApi.approveBooking(id);
            toast({
                title: "Approved",
                description: "Booking has been approved successfully",
            });
            fetchPendingApprovals();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to approve booking",
                variant: "destructive",
            });
        }
    };

    const handleReject = async () => {
        if (!selectedBookingId) return;

        try {
            await adminApi.rejectBooking(selectedBookingId, rejectionReason);
            toast({
                title: "Rejected",
                description: "Booking has been rejected",
            });
            setIsRejectModalOpen(false);
            setRejectionReason("");
            setSelectedBookingId(null);
            fetchPendingApprovals();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to reject booking",
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Clock className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
        );
    }

    if (bookings.length === 0) {
        return (
            <div className="text-center p-12 bg-muted/30 rounded-lg border border-dashed">
                <CheckCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium">No Pending Requests</h3>
                <p className="text-muted-foreground">All booking requests have been processed.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Time Slot</TableHead>
                            <TableHead>Purpose</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bookings.map((booking) => (
                            <TableRow key={booking.id}>
                                <TableCell>
                                    <div>
                                        <p className="font-medium">{booking.users?.firstName} {booking.users?.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{booking.users?.email}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{booking.rooms?.name}</span>
                                        <span className="text-xs bg-secondary px-2 py-0.5 rounded w-fit capitalize">
                                            {booking.rooms?.roomType}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm">
                                        <p>{booking.startTime ? (() => {
                                            try {
                                                return format(new Date(booking.startTime), "MMM d, yyyy");
                                            } catch (e) {
                                                return "Invalid Date";
                                            }
                                        })() : "N/A"}</p>
                                        <p className="text-muted-foreground">
                                            {booking.startTime ? (() => {
                                                try {
                                                    return format(new Date(booking.startTime), "HH:mm");
                                                } catch (e) {
                                                    return "--:--";
                                                }
                                            })() : "--:--"} - {booking.endTime ? (() => {
                                                try {
                                                    return format(new Date(booking.endTime), "HH:mm");
                                                } catch (e) {
                                                    return "--:--";
                                                }
                                            })() : "--:--"}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <p className="text-sm max-w-[200px] truncate" title={booking.description || booking.title}>
                                        {booking.description || booking.title || "No purpose provided"}
                                    </p>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => handleApprove(booking.id)}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                        >
                                            <CheckCircle className="h-4 w-4 mr-1" />
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                                setSelectedBookingId(booking.id);
                                                setIsRejectModalOpen(true);
                                            }}
                                        >
                                            <XCircle className="h-4 w-4 mr-1" />
                                            Reject
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Booking Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this booking request. This will be visible to the user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="reason">Rejection Reason</Label>
                        <Textarea
                            id="reason"
                            placeholder="e.g., Room needed for institutional event, Maintenance scheduled, etc."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="h-32"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={!rejectionReason.trim()}
                        >
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
