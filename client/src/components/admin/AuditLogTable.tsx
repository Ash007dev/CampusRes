"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
    Activity,
    Search,
    Filter,
    Clock,
    ChevronLeft,
    ChevronRight,
    User,
    Info,
    CheckCircle,
    XCircle,
    Calendar,
    MapPin,
    AlertCircle
} from "lucide-react";
import { adminApi, bookingsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export function AuditLogTable() {
    const { toast } = useToast();
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterAction, setFilterAction] = useState<string>("all");
    const [filterEntityType, setFilterEntityType] = useState<string>("all");
    const [searchUser, setSearchUser] = useState("");
    const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);

    // Simple debounce for search
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchUser);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchUser]);

    const fetchLogs = useCallback(async () => {
        try {
            setIsLoading(true);
            const params: any = {
                page,
                limit: 15,
            };

            if (filterAction && filterAction !== "all") {
                params.action = filterAction;
            }

            if (filterEntityType && filterEntityType !== "all") {
                params.entityType = filterEntityType;
            }

            if (debouncedSearch) {
                // If it looks like a UUID, send it as userId
                if (debouncedSearch.length > 20) {
                    params.userId = debouncedSearch;
                }
            }

            const response = await adminApi.getAuditLogs(params);
            setLogs(response.data.data || []);
            setTotalPages(response.data.meta?.totalPages || 1);
        } catch (error) {
            console.error("Failed to fetch audit logs:", error);
            toast({
                title: "Error",
                description: "Failed to load audit logs",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [page, filterAction, filterEntityType, debouncedSearch, toast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleApproveBooking = async (bookingId: string, approved: boolean, reason?: string) => {
        try {
            setProcessingBookingId(bookingId);
            await bookingsApi.approveBooking(bookingId, { approved, reason });
            toast({
                title: "Success",
                description: approved ? "Booking approved successfully" : "Booking rejected successfully",
            });
            fetchLogs(); // Refresh the logs
        } catch (error: any) {
            console.error("Failed to process booking:", error);
            toast({
                title: "Error",
                description: error.response?.data?.error?.message || "Failed to process booking",
                variant: "destructive",
            });
        } finally {
            setProcessingBookingId(null);
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case "CREATE": return "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
            case "UPDATE": return "text-blue-500 bg-blue-50 dark:bg-blue-950/20";
            case "DELETE": return "text-red-500 bg-red-50 dark:bg-red-950/20";
            case "APPROVE": return "text-purple-500 bg-purple-50 dark:bg-purple-950/20";
            case "REJECT": return "text-orange-500 bg-orange-50 dark:bg-orange-950/20";
            case "CANCEL": return "text-gray-500 bg-gray-50 dark:bg-gray-950/20";
            case "CHECK_IN": return "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/20";
            case "LOGIN": return "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20";
            default: return "text-muted-foreground bg-muted";
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "CONFIRMED": return "text-green-600 bg-green-50 dark:bg-green-950/20";
            case "PENDING_APPROVAL": return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20";
            case "CANCELLED": return "text-red-600 bg-red-50 dark:bg-red-950/20";
            case "COMPLETED": return "text-blue-600 bg-blue-50 dark:bg-blue-950/20";
            default: return "text-gray-600 bg-gray-50 dark:bg-gray-950/20";
        }
    };

    const renderBookingDetails = (log: any) => {
        if (!log.booking) return null;

        const { booking } = log;
        const isPendingApproval = booking.status === "PENDING_APPROVAL";

        return (
            <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">{booking.user?.firstName} {booking.user?.lastName}</p>
                            <p className="text-muted-foreground">{booking.user?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">{booking.room?.name}</p>
                            <p className="text-muted-foreground capitalize">{booking.room?.type}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">
                                {format(new Date(booking.startTime), "MMM d, yyyy HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                            </p>
                            {booking.purpose && <p className="text-muted-foreground">{booking.purpose}</p>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status.replace(/_/g, " ")}
                    </span>
                    {isPendingApproval && (
                        <div className="flex gap-2 ml-auto">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleApproveBooking(booking.id, true)}
                                disabled={processingBookingId === booking.id}
                            >
                                <CheckCircle className="h-3 w-3" />
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-red-600 hover:text-red-700"
                                onClick={() => {
                                    const reason = prompt("Reason for rejection (optional):");
                                    handleApproveBooking(booking.id, false, reason || undefined);
                                }}
                                disabled={processingBookingId === booking.id}
                            >
                                <XCircle className="h-3 w-3" />
                                Reject
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex gap-2 items-center w-full md:w-auto flex-wrap">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search User ID..."
                            className="pl-8"
                            value={searchUser}
                            onChange={(e) => setSearchUser(e.target.value)}
                        />
                    </div>
                    <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Entity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Entities</SelectItem>
                            <SelectItem value="booking">Bookings</SelectItem>
                            <SelectItem value="user">Users</SelectItem>
                            <SelectItem value="room">Rooms</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filterAction} onValueChange={setFilterAction}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="CREATE">Create</SelectItem>
                            <SelectItem value="UPDATE">Update</SelectItem>
                            <SelectItem value="DELETE">Delete</SelectItem>
                            <SelectItem value="APPROVE">Approve</SelectItem>
                            <SelectItem value="REJECT">Reject</SelectItem>
                            <SelectItem value="CANCEL">Cancel</SelectItem>
                            <SelectItem value="CHECK_IN">Check In</SelectItem>
                            <SelectItem value="LOGIN">Login</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Performed By</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Entity</TableHead>
                            <TableHead>Activity Details</TableHead>
                            <TableHead className="text-right">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={6} className="h-12 animate-pulse bg-muted/10"></TableCell>
                                </TableRow>
                            ))
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No audit logs found matching criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {log.createdAt ? (() => {
                                            try {
                                                return format(new Date(log.createdAt), "MMM d, HH:mm:ss");
                                            } catch (e) {
                                                return "Invalid Date";
                                            }
                                        })() : "N/A"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <div className="text-xs">
                                                <p className="font-medium">{log.performedBy?.email || "System"}</p>
                                                <p className="text-muted-foreground">
                                                    {log.performedBy?.first_name} {log.performedBy?.last_name}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </span>
                                    </TableCell>
                                    <TableCell className="capitalize text-xs font-medium">
                                        {log.entityType}
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                        {log.entityType === "booking" ? (
                                            renderBookingDetails(log)
                                        ) : (
                                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                                                {log.entityId}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <Info className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>Audit Log Details</DialogTitle>
                                                    <DialogDescription>
                                                        Complete state changes and metadata for this action
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    {log.booking && (
                                                        <div className="bg-muted p-4 rounded-lg">
                                                            <h4 className="font-semibold mb-2">Booking Information</h4>
                                                            {renderBookingDetails(log)}
                                                        </div>
                                                    )}
                                                    <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
                                                        <h4 className="font-semibold mb-2">Raw Data</h4>
                                                        <pre className="text-[10px] font-mono whitespace-pre-wrap">
                                                            {JSON.stringify({
                                                                oldState: log.oldState,
                                                                newState: log.newState,
                                                                metadata: log.metadata,
                                                                previousState: log.previous_state,
                                                                new_state: log.new_state
                                                            }, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
