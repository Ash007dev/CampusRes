"use client";

import * as React from "react";
import { useState } from "react";
import { MessageSquarePlus, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { feedbackApi, type FeedbackCategory, type FeedbackPriority } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface SubmitFeedbackModalProps {
  roomId: string;
  roomName: string;
  bookingId?: string;
  trigger?: React.ReactNode;
}

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string; description: string }[] = [
  { value: "AC_ISSUE", label: "AC Issue", description: "Air conditioning problems" },
  { value: "CLEANLINESS", label: "Cleanliness", description: "Room needs cleaning" },
  { value: "EQUIPMENT", label: "Equipment", description: "Broken or missing equipment" },
  { value: "NOISE", label: "Noise", description: "Noise disturbances" },
  { value: "LIGHTING", label: "Lighting", description: "Lighting issues" },
  { value: "OTHER", label: "Other", description: "Other issues" },
];

const PRIORITY_OPTIONS: { value: FeedbackPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export function SubmitFeedbackModal({ 
  roomId, 
  roomName, 
  bookingId,
  trigger 
}: SubmitFeedbackModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [priority, setPriority] = useState<FeedbackPriority>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const resetForm = () => {
    setCategory("");
    setPriority("MEDIUM");
    setTitle("");
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !title.trim() || !description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await feedbackApi.create({
        roomId,
        bookingId,
        category: category as FeedbackCategory,
        title: title.trim(),
        description: description.trim(),
        priority,
      });

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback. We'll look into it.",
      });

      resetForm();
      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to submit feedback",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Report Issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Submit feedback about <strong>{roomName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Issue Category *</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as FeedbackCategory)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as FeedbackPriority)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide more details about the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
