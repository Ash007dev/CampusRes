"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Search, X, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Types
export interface RoomFilters {
  search: string;
  type: string | null;
  department: string | null;
  capacity: [number, number];
  amenities: string[];
  building: string | null;
  floor: string | null;
  availableNow: boolean;
}

interface RoomFilterProps {
  filters: RoomFilters;
  onFiltersChange: (filters: RoomFilters) => void;
  roomTypes?: string[];
  departments?: { id: string; name: string }[];
  buildings?: string[];
  floors?: string[];
  amenitiesList?: string[];
  maxCapacity?: number;
  className?: string;
  collapsible?: boolean;
}

// Default amenities list
const DEFAULT_AMENITIES = [
  "Projector",
  "Whiteboard",
  "Video Conference",
  "Air Conditioning",
  "WiFi",
  "Power Outlets",
  "Audio System",
  "Screen Sharing",
  "Recording Equipment",
  "Accessible",
];

// Default room types
const DEFAULT_ROOM_TYPES = [
  "LAB",
  "LECTURE_HALL",
  "MEETING_ROOM",
  "SEMINAR_ROOM",
  "CONFERENCE_ROOM",
];

export function RoomFilter({
  filters,
  onFiltersChange,
  roomTypes = DEFAULT_ROOM_TYPES,
  departments = [],
  buildings = [],
  floors = [],
  amenitiesList = DEFAULT_AMENITIES,
  maxCapacity = 200,
  className,
  collapsible = false,
}: RoomFilterProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Update individual filter
  const updateFilter = useCallback(
    <K extends keyof RoomFilters>(key: K, value: RoomFilters[K]) => {
      onFiltersChange({
        ...filters,
        [key]: value,
      });
    },
    [filters, onFiltersChange]
  );

  // Toggle amenity selection
  const toggleAmenity = useCallback(
    (amenity: string) => {
      const currentAmenities = filters.amenities;
      const newAmenities = currentAmenities.includes(amenity)
        ? currentAmenities.filter((a) => a !== amenity)
        : [...currentAmenities, amenity];
      updateFilter("amenities", newAmenities);
    },
    [filters.amenities, updateFilter]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    onFiltersChange({
      search: "",
      type: null,
      department: null,
      capacity: [0, maxCapacity],
      amenities: [],
      building: null,
      floor: null,
      availableNow: false,
    });
  }, [maxCapacity, onFiltersChange]);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.type) count++;
    if (filters.department) count++;
    if (filters.capacity[0] > 0 || filters.capacity[1] < maxCapacity) count++;
    if (filters.amenities.length > 0) count++;
    if (filters.building) count++;
    if (filters.floor) count++;
    if (filters.availableNow) count++;
    return count;
  }, [filters, maxCapacity]);

  const filterContent = (
    <>
      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search rooms..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Room Type */}
      <div className="space-y-2">
        <Label>Room Type</Label>
        <Select
          value={filters.type || "all"}
          onValueChange={(value) =>
            updateFilter("type", value === "all" ? null : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {roomTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Department */}
      {departments.length > 0 && (
        <div className="space-y-2">
          <Label>Department</Label>
          <Select
            value={filters.department || "all"}
            onValueChange={(value) =>
              updateFilter("department", value === "all" ? null : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Building */}
      {buildings.length > 0 && (
        <div className="space-y-2">
          <Label>Building</Label>
          <Select
            value={filters.building || "all"}
            onValueChange={(value) =>
              updateFilter("building", value === "all" ? null : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Buildings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings.map((building) => (
                <SelectItem key={building} value={building}>
                  {building}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Floor */}
      {floors.length > 0 && (
        <div className="space-y-2">
          <Label>Floor</Label>
          <Select
            value={filters.floor || "all"}
            onValueChange={(value) =>
              updateFilter("floor", value === "all" ? null : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Floors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {floors.map((floor) => (
                <SelectItem key={floor} value={floor}>
                  Floor {floor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Capacity Slider */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Minimum Capacity</Label>
          <span className="text-sm text-muted-foreground">
            {filters.capacity[0]}+ people
          </span>
        </div>
        <Slider
          value={[filters.capacity[0]]}
          min={0}
          max={maxCapacity}
          step={5}
          onValueChange={(value) =>
            updateFilter("capacity", [value[0], maxCapacity])
          }
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>{maxCapacity}+</span>
        </div>
      </div>

      {/* Available Now */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="availableNow"
          checked={filters.availableNow}
          onCheckedChange={(checked) =>
            updateFilter("availableNow", checked as boolean)
          }
        />
        <Label htmlFor="availableNow" className="cursor-pointer">
          Available Now
        </Label>
      </div>

      {/* Amenities */}
      <div className="space-y-3">
        <Label>Amenities</Label>
        <div className="flex flex-wrap gap-2">
          {amenitiesList.map((amenity) => {
            const isSelected = filters.amenities.includes(amenity);
            return (
              <Badge
                key={amenity}
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected && "bg-primary"
                )}
                onClick={() => toggleAmenity(amenity)}
              >
                {amenity}
                {isSelected && <X className="ml-1 h-3 w-3" />}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          onClick={clearFilters}
          className="w-full text-muted-foreground"
        >
          <X className="mr-2 h-4 w-4" />
          Clear Filters ({activeFilterCount})
        </Button>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="font-semibold">Filters</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Filter Content */}
      {isExpanded && <div className="space-y-6">{filterContent}</div>}
    </div>
  );
}

// Hook for managing filter state
export function useRoomFilters(maxCapacity = 200) {
  const [filters, setFilters] = useState<RoomFilters>({
    search: "",
    type: null,
    department: null,
    capacity: [0, maxCapacity],
    amenities: [],
    building: null,
    floor: null,
    availableNow: false,
  });

  return { filters, setFilters };
}

export type { RoomFilterProps };
