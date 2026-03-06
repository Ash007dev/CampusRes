"use client";

import React, { useState, useEffect } from "react";
import { Building2, CheckCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roomsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface EditRoomModalProps {
    room: any | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function EditRoomModal({ room, isOpen, onClose, onSuccess }: EditRoomModalProps) {
    const [name, setName] = useState("");
    const [building, setBuilding] = useState("");
    const [floor, setFloor] = useState("");
    const [capacity, setCapacity] = useState(30);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (room) {
            setName(room.name || "");
            setBuilding(room.building || "");
            setFloor(String(room.floor ?? ""));
            setCapacity(room.capacity || 30);
        }
    }, [room]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!room) return;

        setIsSubmitting(true);
        try {
            await roomsApi.update(room.id, {
                name,
                building,
                floor: Number(floor),
                capacity,
            });
            setIsSuccess(true);
            setTimeout(() => {
                setIsSuccess(false);
                onSuccess();
                onClose();
            }, 1200);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.response?.data?.error?.message || "Failed to update room",
                variant: "destructive",
            });
            setIsSubmitting(false);
        }
    };

    if (!room) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Room</DialogTitle>
                    <DialogDescription>
                        Update room details for {room.code}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {isSuccess && (
                        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
                            <div className="animate-bounce mb-4">
                                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle className="h-10 w-10 text-green-500" />
                                </div>
                            </div>
                            <p className="text-lg font-semibold">Room Updated!</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="room-name">Room Name</Label>
                        <Input id="room-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="room-building">Building</Label>
                            <Input id="room-building" value={building} onChange={(e) => setBuilding(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="room-floor">Floor</Label>
                            <Input id="room-floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="room-capacity">Capacity</Label>
                        <Input id="room-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
