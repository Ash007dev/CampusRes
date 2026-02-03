"use client";

import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { roomsApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

interface Room {
  id: string;
  name: string;
  code: string;
  amenities: Record<string, boolean>;
}

interface EditRoomAmenitiesModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Standard amenities list with display names
const AMENITIES_CONFIG = [
  { key: 'wifi', label: 'WiFi', icon: '📡' },
  { key: 'projector', label: 'Projector', icon: '📽️' },
  { key: 'whiteboard', label: 'Whiteboard', icon: '📝' },
  { key: 'ac', label: 'Air Conditioning', icon: '❄️' },
  { key: 'microphone', label: 'Microphone', icon: '🎤' },
  { key: 'videoConference', label: 'Video Conferencing', icon: '📹' },
  { key: 'computers', label: 'Computer Lab', icon: '💻' },
  { key: 'wheelchairAccessible', label: 'Wheelchair Accessible', icon: '♿' },
  { key: 'smartBoard', label: 'Smart Board', icon: '📊' },
  { key: 'soundSystem', label: 'Sound System', icon: '🔊' },
];

export function EditRoomAmenitiesModal({ room, isOpen, onClose, onSuccess }: EditRoomAmenitiesModalProps) {
  const [amenitiesState, setAmenitiesState] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (room) {
      setAmenitiesState(room.amenities || {});
      setHasChanges(false);
    }
  }, [room]);

  const toggleAmenity = (key: string) => {
    setAmenitiesState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setHasChanges(true);
  };

  const handleSubmit = async () => {
    if (!room) return;

    setIsSubmitting(true);
    try {
      await roomsApi.update(room.id, { amenities: amenitiesState });
      toast({
        title: 'Success',
        description: 'Amenities updated successfully',
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.response?.data?.error?.message || 'Failed to update amenities',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirm) return;
    }
    onClose();
  };

  if (!room) return null;

  const activeAmenities = AMENITIES_CONFIG.filter(a => amenitiesState[a.key] === true);
  const inactiveAmenities = AMENITIES_CONFIG.filter(a => !amenitiesState[a.key]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold mb-1">
                Manage Amenities
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-sm">
                  {room.code}
                </Badge>
                <span className="text-sm text-muted-foreground">{room.name}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Active Amenities */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-sm text-green-600 dark:text-green-400">
                Active Amenities ({activeAmenities.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeAmenities.map((amenity) => (
                <div
                  key={amenity.key}
                  className="flex items-center justify-between p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{amenity.icon}</span>
                    <span className="font-medium text-sm">{amenity.label}</span>
                  </div>
                  <Switch
                    checked={true}
                    onCheckedChange={() => toggleAmenity(amenity.key)}
                  />
                </div>
              ))}
            </div>
            {activeAmenities.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No active amenities
              </div>
            )}
          </div>

          {/* Inactive/Unavailable Amenities */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-neutral-500" />
              <h3 className="font-semibold text-sm text-neutral-600 dark:text-neutral-400">
                Unavailable Amenities ({inactiveAmenities.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inactiveAmenities.map((amenity) => (
                <div
                  key={amenity.key}
                  className="flex items-center justify-between p-3 rounded-lg border bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800"
                >
                  <div className="flex items-center gap-2 opacity-60">
                    <span className="text-xl grayscale">{amenity.icon}</span>
                    <span className="font-medium text-sm line-through decoration-2">
                      {amenity.label}
                    </span>
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={() => toggleAmenity(amenity.key)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">About Amenity Management</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Toggle amenities on/off to indicate availability. Inactive amenities will appear 
                  with strikethrough text to inform users they are currently unavailable.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !hasChanges}
              className="rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-300"
            >
              {isSubmitting ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
