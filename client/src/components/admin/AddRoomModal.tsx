"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Users, MapPin, CheckCircle, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Validation schema
const roomSchema = z.object({
  name: z.string().min(3, "Room name must be at least 3 characters"),
  code: z.string().optional(),
  building: z.string().min(1, "Building is required"),
  floor: z.string().min(1, "Floor is required"),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  roomType: z.enum(["LAB", "LECTURE_HALL", "MEETING_ROOM", "SEMINAR_ROOM", "CONFERENCE_ROOM"]),
  departmentId: z.string().optional(),
  amenities: z.record(z.boolean()).optional(),
});

type RoomFormData = z.infer<typeof roomSchema>;

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RoomFormData) => Promise<void>;
  departments?: Array<{ id: string; name: string }>;
}

const AMENITIES_LIST = [
  "WiFi",
  "Projector",
  "Whiteboard",
  "Air Conditioning",
  "Video Conference",
  "Audio System",
  "Power Outlets",
  "Accessible",
];

const ROOM_TYPES = [
  { value: "LAB", label: "Lab" },
  { value: "LECTURE_HALL", label: "Lecture Hall" },
  { value: "MEETING_ROOM", label: "Meeting Room" },
  { value: "SEMINAR_ROOM", label: "Seminar Room" },
  { value: "CONFERENCE_ROOM", label: "Conference Room" },
];

export function AddRoomModal({
  isOpen,
  onClose,
  onSubmit,
  departments = [],
}: AddRoomModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAmenities, setSelectedAmenities] = useState<Record<string, boolean>>({});

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: "",
      code: "",
      building: "",
      floor: "",
      capacity: 30,
      roomType: "MEETING_ROOM",
      amenities: {},
    },
  });

  const handleAmenityToggle = (amenity: string) => {
    setSelectedAmenities((prev) => ({
      ...prev,
      [amenity]: !prev[amenity],
    }));
  };

  const onFormSubmit = async (data: RoomFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Add amenities to form data
      const submitData = {
        ...data,
        amenities: selectedAmenities,
      };
      
      await onSubmit(submitData);
      setIsSuccess(true);
      
      // Reset and close after success animation
      setTimeout(() => {
        reset();
        setSelectedAmenities({});
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setSelectedAmenities({});
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Room</DialogTitle>
          <DialogDescription>
            Create a new room with capacity and amenities to update inventory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Success Animation */}
          {isSuccess && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
              <div className="animate-bounce mb-4">
                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              </div>
              <p className="text-lg font-semibold">Room Created Successfully!</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Basic Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Room Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Computer Lab 101"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Room Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., CL-101"
                  {...register("code")}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="building">Building *</Label>
                <Input
                  id="building"
                  placeholder="e.g., Main Building"
                  {...register("building")}
                />
                {errors.building && (
                  <p className="text-sm text-destructive">{errors.building.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="floor">Floor *</Label>
                <Input
                  id="floor"
                  placeholder="e.g., 1"
                  {...register("floor")}
                />
                {errors.floor && (
                  <p className="text-sm text-destructive">{errors.floor.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="30"
                  {...register("capacity")}
                />
                {errors.capacity && (
                  <p className="text-sm text-destructive">{errors.capacity.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Room Type *</Label>
                <Select
                  defaultValue="MEETING_ROOM"
                  onValueChange={(value) => setValue("roomType", value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roomType && (
                  <p className="text-sm text-destructive">{errors.roomType.message}</p>
                )}
              </div>

              {departments.length > 0 && (
                <div className="space-y-2">
                  <Label>Department (Optional)</Label>
                  <Select
                    onValueChange={(value) => setValue("departmentId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-4">
            <h3 className="font-semibold">Amenities</h3>
            <div className="grid grid-cols-2 gap-3">
              {AMENITIES_LIST.map((amenity) => (
                <div key={amenity} className="flex items-center space-x-2">
                  <Checkbox
                    id={amenity}
                    checked={selectedAmenities[amenity] || false}
                    onCheckedChange={() => handleAmenityToggle(amenity)}
                  />
                  <Label
                    htmlFor={amenity}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {amenity}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                "Create Room"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
