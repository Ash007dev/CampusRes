"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Filter,
  RefreshCw,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "../ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "../ui/scroll-area";
import { feedbackApi, type Feedback, type FeedbackStatus, type FeedbackCategory, type FeedbackPriority, type FeedbackStats } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface FeedbackReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  AC_ISSUE: "AC Issue",
  CLEANLINESS: "Cleanliness",
  EQUIPMENT: "Equipment",
  NOISE: "Noise",
  LIGHTING: "Lighting",
  OTHER: "Other",
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  OPEN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CLOSED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  LOW: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function FeedbackReviewModal({ isOpen, onClose }: FeedbackReviewModalProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 50 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;

      const [feedbackRes, statsRes] = await Promise.all([
        feedbackApi.getAll(params),
        feedbackApi.getStats(),
      ]);

      setFeedback(feedbackRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (error) {
      console.error("Failed to fetch feedback:", error);
      toast({
        title: "Error",
        description: "Failed to load feedback",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchFeedback();
    }
  }, [isOpen, fetchFeedback]);

  const handleUpdateStatus = async (id: string, newStatus: FeedbackStatus) => {
    setIsUpdating(true);
    try {
      await feedbackApi.update(id, { status: newStatus });
      toast({
        title: "Status Updated",
        description: `Feedback marked as ${newStatus.toLowerCase().replace("_", " ")}`,
      });
      fetchFeedback();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePriority = async (id: string, newPriority: FeedbackPriority) => {
    setIsUpdating(true);
    try {
      await feedbackApi.update(id, { priority: newPriority });
      toast({
        title: "Priority Updated",
        description: `Priority set to ${newPriority.toLowerCase()}`,
      });
      fetchFeedback();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update priority",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddNote = async (id: string) => {
    if (!adminNotes.trim()) return;

    setIsUpdating(true);
    try {
      const item = feedback.find(f => f.id === id);
      const existingNotes = item?.adminNotes || "";
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n[${format(new Date(), "MMM d, yyyy HH:mm")}]\n${adminNotes}`
        : `[${format(new Date(), "MMM d, yyyy HH:mm")}]\n${adminNotes}`;

      await feedbackApi.update(id, { adminNotes: newNotes });
      toast({
        title: "Note Added",
        description: "Admin note has been saved",
      });
      setAdminNotes("");
      fetchFeedback();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setAdminNotes("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback Review
          </DialogTitle>
          <DialogDescription>
            Review and manage user feedback about rooms and facilities
          </DialogDescription>
        </DialogHeader>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 py-3">
            <div className="text-center p-2 rounded-lg bg-muted">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.open}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inProgress}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 py-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="AC_ISSUE">AC Issue</SelectItem>
              <SelectItem value="CLEANLINESS">Cleanliness</SelectItem>
              <SelectItem value="EQUIPMENT">Equipment</SelectItem>
              <SelectItem value="NOISE">Noise</SelectItem>
              <SelectItem value="LIGHTING">Lighting</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchFeedback} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        <Separator />

        {/* Feedback List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feedback found</p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpanded(item.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn("text-xs", STATUS_COLORS[item.status])}>
                            {item.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[item.category]}
                          </Badge>
                          <Badge className={cn("text-xs", PRIORITY_COLORS[item.priority])}>
                            {item.priority}
                          </Badge>
                        </div>
                        <h4 className="font-medium truncate">{item.title}</h4>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          {item.room && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {item.room.name}
                            </span>
                          )}
                          {item.user && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.user.firstName} {item.user.lastName}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      {expandedId === item.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedId === item.id && (
                    <div className="px-4 pb-4 border-t bg-muted/30">
                      <div className="pt-4 space-y-4">
                        {/* Description */}
                        <div>
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{item.description}</p>
                        </div>

                        {/* Admin Notes */}
                        {item.adminNotes && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Admin Notes</Label>
                            <pre className="text-sm mt-1 whitespace-pre-wrap bg-background p-2 rounded border">
                              {item.adminNotes}
                            </pre>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2">
                          <Select
                            value={item.status}
                            onValueChange={(v) => handleUpdateStatus(item.id, v as FeedbackStatus)}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OPEN">Open</SelectItem>
                              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                              <SelectItem value="RESOLVED">Resolved</SelectItem>
                              <SelectItem value="CLOSED">Closed</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={item.priority}
                            onValueChange={(v) => handleUpdatePriority(item.id, v as FeedbackPriority)}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LOW">Low</SelectItem>
                              <SelectItem value="MEDIUM">Medium</SelectItem>
                              <SelectItem value="HIGH">High</SelectItem>
                              <SelectItem value="URGENT">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Add Note */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Add Note</Label>
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Add admin notes..."
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              className="min-h-[60px]"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleAddNote(item.id)}
                              disabled={isUpdating || !adminNotes.trim()}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Resolution Info */}
                        {item.resolvedAt && (
                          <div className="text-xs text-muted-foreground pt-2 border-t">
                            <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
                            Resolved on {format(new Date(item.resolvedAt), "MMM d, yyyy 'at' HH:mm")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
