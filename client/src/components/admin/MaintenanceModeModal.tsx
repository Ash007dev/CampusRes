"use client";

import * as React from "react";
import { useState } from "react";
import { AlertTriangle, Loader2, Wrench, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { roomsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Room {
  id: string;
  name: string;
  code: string;
  isMaintenance?: boolean;
}

interface MaintenanceModeModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MaintenanceModeModal({ 
  room, 
  isOpen, 
  onClose, 
  onSuccess 
}: MaintenanceModeModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  const isEnablingMaintenance = !room?.isMaintenance;

  const handleSubmit = async () => {
    if (!room) return;

    // If enabling maintenance, show confirmation first
    if (isEnablingMaintenance && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await roomsApi.setMaintenance(
        room.id, 
        isEnablingMaintenance, 
        reason || undefined
      );

      const data = response.data.data;
      
      if (isEnablingMaintenance && data.cancelledBookings > 0) {
        toast({
          title: "Maintenance Mode Enabled",
          description: `${room.name} is now under maintenance. ${data.cancelledBookings} booking(s) have been cancelled.`,
        });
      } else if (isEnablingMaintenance) {
        toast({
          title: "Maintenance Mode Enabled",
          description: `${room.name} is now under maintenance. No bookings were affected.`,
        });
      } else {
        toast({
          title: "Maintenance Mode Disabled",
          description: `${room.name} is now available for bookings.`,
        });
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update maintenance status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowConfirmation(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setShowConfirmation(false);
    onClose();
  };

  if (!room) return null;

  return (
    <>
      <Dialog open={isOpen && !showConfirmation} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {isEnablingMaintenance ? "Enable" : "Disable"} Maintenance Mode
            </DialogTitle>
            <DialogDescription>
              {isEnablingMaintenance 
                ? "Mark this room as under maintenance. All future bookings will be automatically cancelled."
                : "Remove maintenance mode and make the room available for bookings again."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Room Info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">{room.name}</p>
                <p className="text-sm text-muted-foreground">{room.code}</p>
              </div>
              <Badge variant={room.isMaintenance ? "destructive" : "secondary"}>
                {room.isMaintenance ? "Under Maintenance" : "Active"}
              </Badge>
            </div>

            {/* Reason Input (only for enabling) */}
            {isEnablingMaintenance && (
              <div className="space-y-2">
                <Label htmlFor="reason">Maintenance Reason (Optional)</Label>
                <Input
                  id="reason"
                  placeholder="e.g., Painting, AC repair, Equipment upgrade..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This will be shown to users whose bookings are cancelled.
                </p>
              </div>
            )}

            {/* Warning */}
            {isEnablingMaintenance && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Warning</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    All future bookings for this room will be automatically cancelled. 
                    Affected users will be notified.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              variant={isEnablingMaintenance ? "destructive" : "default"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : isEnablingMaintenance ? (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Enable Maintenance
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Disable Maintenance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Maintenance Mode</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to enable maintenance mode for <strong>{room.name}</strong>? 
              All future bookings will be cancelled and affected users will be notified.
              {reason && (
                <span className="block mt-2">
                  Reason: <strong>{reason}</strong>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Yes, Enable Maintenance"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
