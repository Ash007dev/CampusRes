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
    Info
} from "lucide-react";
import { adminApi } from "@/lib/api";
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

export function AuditLogTable() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterAction, setFilterAction] = useState<string>("all");
    const [searchUser, setSearchUser] = useState("");

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
        } finally {
            setIsLoading(false);
        }
    }, [page, filterAction, debouncedSearch]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getActionColor = (action: string) => {
        switch (action) {
            case "CREATE": return "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
            case "UPDATE": return "text-blue-500 bg-blue-50 dark:bg-blue-950/20";
            case "DELETE": return "text-red-500 bg-red-50 dark:bg-red-950/20";
            case "APPROVE": return "text-purple-500 bg-purple-50 dark:bg-purple-950/20";
            case "REJECT": return "text-orange-500 bg-orange-50 dark:bg-orange-950/20";
            default: return "text-muted-foreground bg-muted";
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex gap-2 items-center w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search User ID..."
                            className="pl-8"
                            value={searchUser}
                            onChange={(e) => setSearchUser(e.target.value)}
                        />
                    </div>
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
                            <TableHead>User</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Entity</TableHead>
                            <TableHead>ID</TableHead>
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
                                        {log.created_at ? (() => {
                                            try {
                                                return format(new Date(log.created_at), "MMM d, HH:mm:ss");
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
                                                <p className="font-medium">{log.performed_by?.email || "System"}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </span>
                                    </TableCell>
                                    <TableCell className="capitalize text-xs font-medium">
                                        {log.entity_type}
                                    </TableCell>
                                    <TableCell className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">
                                        {log.entity_id}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <Info className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>Log Details</DialogTitle>
                                                    <DialogDescription>
                                                        Full state changes for this action
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
                                                    <pre className="text-[10px] font-mono whitespace-pre-wrap">
                                                        {JSON.stringify({
                                                            old_state: log.old_state,
                                                            new_state: log.new_state,
                                                            metadata: log.metadata
                                                        }, null, 2)}
                                                    </pre>
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
