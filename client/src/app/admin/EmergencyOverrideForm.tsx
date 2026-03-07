import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bookingsApi } from "@/lib/api";
import { ChevronDown, AlertTriangle, Mail, Clock, Users, X } from "lucide-react";

interface EmergencyOverrideFormProps {
  rooms: any[];
  toast: any;
  fetchData: any;
}

const DURATION_OPTIONS = [
  { label: "1 Hour", value: 60 },
  { label: "2 Hours", value: 120 },
  { label: "3 Hours", value: 180 },
  { label: "4 Hours", value: 240 },
  { label: "6 Hours", value: 360 },
  { label: "Full Day", value: 1440 },
  { label: "Custom", value: 0 },
];

export function EmergencyOverrideForm({ rooms, toast, fetchData }: EmergencyOverrideFormProps) {
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [affectedUsers, setAffectedUsers] = useState<string[]>([]);
  const [cancelledCount, setCancelledCount] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);

  const allSelected = rooms.length > 0 && selectedRooms.length === rooms.length;

  // Toggle individual room
  const toggleRoom = (roomId: string) => {
    setSelectedRooms(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  // Toggle all rooms
  const toggleAll = () => {
    if (allSelected) {
      setSelectedRooms([]);
    } else {
      setSelectedRooms(rooms.map(r => r.id));
    }
  };

  // Compute end date/time when duration or start changes
  const applyDuration = (dur: number, sDate: string, sTime: string) => {
    if (!sDate || !sTime || dur === 0) return;
    const start = new Date(`${sDate}T${sTime}`);
    const end = new Date(start.getTime() + dur * 60000);
    setEndDate(end.toISOString().split("T")[0]);
    setEndTime(end.toTimeString().slice(0, 5));
  };

  const handleDurationChange = (dur: number) => {
    setDuration(dur);
    applyDuration(dur, startDate, startTime);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (duration > 0) applyDuration(duration, val, startTime);
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (duration > 0) applyDuration(duration, startDate, val);
  };

  // Build ISO strings for API
  const buildDateTime = (date: string, time: string) => {
    if (!date || !time) return "";
    return `${date}T${time}:00`;
  };

  // Selected room names for display
  const selectedRoomNames = useMemo(
    () => rooms.filter(r => selectedRooms.includes(r.id)).map(r => r.name),
    [rooms, selectedRooms]
  );

  // Handle override
  const handleOverride = async () => {
    const start = buildDateTime(startDate, startTime);
    const end = buildDateTime(endDate, endTime);

    if (!start || !end || selectedRooms.length === 0) {
      toast({ title: "Missing Fields", description: "Please select date/time range and at least one room.", variant: "destructive" });
      return;
    }

    if (new Date(end) <= new Date(start)) {
      toast({ title: "Invalid Time Range", description: "End time must be after start time.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const payload = { rooms: selectedRooms, startDate: start, endDate: end, reason };
      const res = await bookingsApi.emergencyOverride(payload);
      const data = res.data.data;
      setCancelledCount(data.cancelledCount);
      setAffectedUsers(data.affectedUsers);
      setResultMsg(data.message || "Override completed.");
      toast({ title: "Override Success", description: `${data.cancelledCount} bookings cancelled. ${data.affectedUsers.length} users notified via email.` });
      fetchData(true);
    } catch (error: any) {
      toast({ title: "Override Failed", description: error?.response?.data?.error?.message || error.message || "Failed to override.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-800 dark:text-red-200">Emergency Override</p>
          <p className="text-xs text-red-600 dark:text-red-400">This will cancel all bookings in the selected time range and rooms. Affected users will be notified via email.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form Inputs */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Override Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Room Multi-Select Dropdown */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Room(s)</label>
              <Popover open={roomDropdownOpen} onOpenChange={setRoomDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-normal h-auto min-h-[40px]"
                  >
                    <div className="flex flex-wrap gap-1 flex-1">
                      {selectedRooms.length === 0 ? (
                        <span className="text-muted-foreground">Select rooms...</span>
                      ) : allSelected ? (
                        <Badge variant="secondary">All Rooms ({rooms.length})</Badge>
                      ) : selectedRoomNames.length <= 3 ? (
                        selectedRoomNames.map(name => (
                          <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                        ))
                      ) : (
                        <Badge variant="secondary">{selectedRooms.length} rooms selected</Badge>
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <div className="max-h-[280px] overflow-y-auto">
                    {/* Select All */}
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer hover:bg-accent"
                      onClick={toggleAll}
                    >
                      <Checkbox checked={allSelected} />
                      <span className="text-sm font-medium">Select All Rooms</span>
                    </div>
                    {/* Individual Rooms */}
                    {rooms.map(room => (
                      <div
                        key={room.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent"
                        onClick={() => toggleRoom(room.id)}
                      >
                        <Checkbox checked={selectedRooms.includes(room.id)} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">{room.name}</span>
                          {room.building && (
                            <span className="text-xs text-muted-foreground ml-2">({room.building})</span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{room.type}</Badge>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedRooms.length > 0 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setSelectedRooms([])}>
                    <X className="h-3 w-3 mr-1" /> Clear selection
                  </Button>
                </div>
              )}
            </div>

            {/* Duration Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" /> Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    variant={duration === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDurationChange(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Date/Time Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Time</label>
                <Input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  disabled={duration !== 0}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Time</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  disabled={duration !== 0}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Override Reason</label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., Fire drill, maintenance emergency, power outage..."
                rows={3}
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full bg-red-600 text-white hover:bg-red-700"
              disabled={isLoading || selectedRooms.length === 0 || !startDate || !startTime || !endDate || !endTime}
              onClick={handleOverride}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Override & Cancel All Bookings
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Results / Affected Users */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Affected Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cancelledCount !== null ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{cancelledCount}</div>
                    <div className="text-xs text-muted-foreground">Bookings Cancelled</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">{affectedUsers.length}</div>
                    <div className="text-xs text-muted-foreground">Users Notified</div>
                  </div>
                </div>

                {resultMsg && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{resultMsg}</div>
                )}

                {/* User List */}
                {affectedUsers.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Notified Users
                    </div>
                    <div className="max-h-[280px] overflow-y-auto space-y-1 rounded-lg border p-2">
                      {affectedUsers.map((email, idx) => (
                        <div
                          key={email}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <div className="h-6 w-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-medium text-red-700 dark:text-red-300">
                            {idx + 1}
                          </div>
                          <span className="truncate">{email}</span>
                          <Mail className="h-3 w-3 text-green-500 shrink-0 ml-auto" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Affected users and cancelled booking details will appear here after executing the override.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
