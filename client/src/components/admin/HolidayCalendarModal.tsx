"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameMonth } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { holidayApi, Holiday } from "@/lib/api";

interface HolidayCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HolidayCalendarModal({ isOpen, onClose }: HolidayCalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "HOLIDAY" as Holiday["type"],
    description: "",
  });
  const { toast } = useToast();

  // Fetch holidays for current month
  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const res = await holidayApi.getHolidaysInRange(start, end);
      setHolidays(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch holidays:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    if (isOpen) {
      fetchHolidays();
    }
  }, [isOpen, fetchHolidays]);

  // Generate calendar days
  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days: Date[] = [];
    
    // Add padding days from previous month
    const startDay = start.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(d.getDate() - i - 1);
      days.push(d);
    }
    
    // Add days of current month
    let current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    // Add padding days for next month
    while (days.length % 7 !== 0) {
      const d = new Date(days[days.length - 1]);
      d.setDate(d.getDate() + 1);
      days.push(d);
    }
    
    return days;
  };

  const getHolidaysForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return holidays.filter((h) => h.date === dateStr);
  };

  const handleAddHoliday = async () => {
    if (!selectedDate || !formData.name) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      await holidayApi.addHoliday({
        date: selectedDate,
        name: formData.name,
        type: formData.type,
        description: formData.description || undefined,
      });
      toast({ title: "Success", description: "Holiday added successfully" });
      setIsAddModalOpen(false);
      setFormData({ name: "", type: "HOLIDAY", description: "" });
      fetchHolidays();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add holiday", variant: "destructive" });
    }
  };

  const handleUpdateHoliday = async () => {
    if (!editingHoliday) return;

    try {
      await holidayApi.updateHoliday(editingHoliday.id, {
        name: formData.name,
        type: formData.type,
        description: formData.description || undefined,
      });
      toast({ title: "Success", description: "Holiday updated successfully" });
      setEditingHoliday(null);
      setFormData({ name: "", type: "HOLIDAY", description: "" });
      fetchHolidays();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update holiday", variant: "destructive" });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;

    try {
      await holidayApi.deleteHoliday(id);
      toast({ title: "Success", description: "Holiday deleted successfully" });
      fetchHolidays();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete holiday", variant: "destructive" });
    }
  };

  const openAddModal = (date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setFormData({ name: "", type: "HOLIDAY", description: "" });
    setIsAddModalOpen(true);
  };

  const openEditModal = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      type: holiday.type,
      description: holiday.description || "",
    });
  };

  const getTypeColor = (type: Holiday["type"]) => {
    switch (type) {
      case "HOLIDAY":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "WEEKEND":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "MAINTENANCE":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "CUSTOM":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const days = getDaysInMonth();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Holiday Calendar Management
          </DialogTitle>
          <DialogDescription>
            Manage academic holidays and blocked dates. Click on any date to add a holiday.
          </DialogDescription>
        </DialogHeader>

        {/* Month Navigation */}
        <div className="flex items-center justify-between py-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-sm mb-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
            <span>Holiday</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-500/20 border border-gray-500/30" />
            <span>Weekend</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/30" />
            <span>Maintenance</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30" />
            <span>Custom</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border rounded-lg overflow-hidden">
          {/* Week days header */}
          <div className="grid grid-cols-7 bg-muted/50">
            {weekDays.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium border-b">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {days.map((date, idx) => {
              const dateHolidays = getHolidaysForDate(date);
              const isCurrentMonth = isSameMonth(date, currentMonth);
              const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[100px] p-2 border-b border-r relative group",
                    !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-medium", isToday && "text-primary")}>
                      {format(date, "d")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openAddModal(date)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Holidays for this date */}
                  <div className="mt-1 space-y-1">
                    {dateHolidays.slice(0, 2).map((holiday) => (
                      <div
                        key={holiday.id}
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 flex items-center justify-between group/item",
                          getTypeColor(holiday.type)
                        )}
                        onClick={() => openEditModal(holiday)}
                      >
                        <span className="truncate">{holiday.name}</span>
                        <button
                          className="opacity-0 group-hover/item:opacity-100 ml-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHoliday(holiday.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {dateHolidays.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{dateHolidays.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-muted-foreground pt-4">
          <span>Total holidays this month: <strong className="text-foreground">{holidays.filter(h => h.type === 'HOLIDAY').length}</strong></span>
          <span>Weekends: <strong className="text-foreground">{holidays.filter(h => h.type === 'WEEKEND').length}</strong></span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {/* Add Holiday Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Add a new holiday for {selectedDate ? format(parseISO(selectedDate), "MMMM d, yyyy") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Holiday name"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as Holiday["type"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOLIDAY">Holiday</SelectItem>
                  <SelectItem value="WEEKEND">Weekend</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddHoliday}>Add Holiday</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Holiday Modal */}
      <Dialog open={!!editingHoliday} onOpenChange={() => setEditingHoliday(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Holiday</DialogTitle>
            <DialogDescription>
              Update holiday details for {editingHoliday?.date ? format(parseISO(editingHoliday.date), "MMMM d, yyyy") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Holiday name"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as Holiday["type"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOLIDAY">Holiday</SelectItem>
                  <SelectItem value="WEEKEND">Weekend</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingHoliday(null)}>Cancel</Button>
            <Button onClick={handleUpdateHoliday}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
