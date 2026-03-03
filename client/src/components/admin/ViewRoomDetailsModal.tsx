"use client";

import { Building2, Users, MapPin, Settings, Wrench } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ViewRoomDetailsModalProps {
    room: any | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ViewRoomDetailsModal({
    room,
    isOpen,
    onClose,
}: ViewRoomDetailsModalProps) {
    if (!room) return null;

    const amenityList = room.amenities
        ? typeof room.amenities === "object"
            ? Object.entries(room.amenities)
                .filter(([, v]) => v === true)
                .map(([k]) => k)
            : []
        : [];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Room Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Room header */}
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Building2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">{room.name}</h3>
                            <p className="text-sm text-muted-foreground">{room.code}</p>
                        </div>
                        <div className="ml-auto">
                            <Badge variant={room.isMaintenance || room.is_maintenance ? "destructive" : "default"}>
                                {room.isMaintenance || room.is_maintenance ? "Maintenance" : "Available"}
                            </Badge>
                        </div>
                    </div>

                    <Separator />

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                Building
                            </span>
                            <p className="font-medium">{room.building || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                Floor
                            </span>
                            <p className="font-medium">{room.floor ?? "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                Capacity
                            </span>
                            <p className="font-medium">{room.capacity} seats</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Settings className="h-4 w-4" />
                                Type
                            </span>
                            <p className="font-medium">{room.room_type || room.roomType || "N/A"}</p>
                        </div>
                    </div>

                    {/* Amenities */}
                    {amenityList.length > 0 && (
                        <>
                            <Separator />
                            <div>
                                <h4 className="text-sm font-medium mb-2">Amenities</h4>
                                <div className="flex flex-wrap gap-2">
                                    {amenityList.map((a: string) => (
                                        <Badge key={a} variant="outline" className="rounded-lg">
                                            {a}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Department */}
                    {(room.departments?.name || room.departmentName) && (
                        <>
                            <Separator />
                            <div className="space-y-1">
                                <span className="text-sm text-muted-foreground">Department</span>
                                <p className="font-medium">{room.departments?.name || room.departmentName}</p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
