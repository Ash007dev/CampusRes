"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    BarChart3,
    CalendarDays,
    Clock,
    TrendingUp,
    RefreshCw,
    Loader2,
    Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { adminApi } from "@/lib/api";

// Types matching the backend DemandForecastResult
interface HourlyDemand {
    hour: number;
    avgBookings: number;
    peakLabel: "LOW" | "MEDIUM" | "HIGH";
}

interface DayForecast {
    dayOfWeek: number;
    dayName: string;
    hourlyDemand: HourlyDemand[];
}

interface ForecastData {
    forecast: DayForecast[];
    totalBookingsAnalyzed: number;
    periodDays: number;
    generatedAt: string;
}

// Color map for peak labels
const PEAK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    LOW: {
        bg: "bg-emerald-500/20",
        text: "text-emerald-700 dark:text-emerald-400",
        border: "border-emerald-500/30",
    },
    MEDIUM: {
        bg: "bg-amber-500/30",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-500/30",
    },
    HIGH: {
        bg: "bg-red-500/35",
        text: "text-red-700 dark:text-red-400",
        border: "border-red-500/30",
    },
};

// Intensity based on avgBookings relative to max
function getIntensityStyle(avgBookings: number, maxAvg: number, peakLabel: string) {
    if (maxAvg === 0 || avgBookings === 0) {
        return "bg-muted/30 text-muted-foreground/50";
    }
    return PEAK_COLORS[peakLabel]?.bg ?? "bg-muted/30";
}

export function DemandForecastHeatmap() {
    const [data, setData] = useState<ForecastData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [days, setDays] = useState("30");
    const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);
    const { toast } = useToast();

    const fetchForecast = async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const res = await adminApi.getDemandForecast(parseInt(days));
            setData(res.data.data);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to load demand forecast",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchForecast();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days]);

    // Compute max avg for intensity scaling
    const maxAvg = React.useMemo(() => {
        if (!data) return 0;
        let max = 0;
        for (const day of data.forecast) {
            for (const h of day.hourlyDemand) {
                if (h.avgBookings > max) max = h.avgBookings;
            }
        }
        return max;
    }, [data]);

    // Summary stats
    const summaryStats = React.useMemo(() => {
        if (!data) return null;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        let peakDay = "";
        let peakHour = 0;
        let peakVal = 0;

        for (const day of data.forecast) {
            for (const h of day.hourlyDemand) {
                if (h.peakLabel === "HIGH") highCount++;
                else if (h.peakLabel === "MEDIUM") mediumCount++;
                else lowCount++;

                if (h.avgBookings > peakVal) {
                    peakVal = h.avgBookings;
                    peakDay = day.dayName;
                    peakHour = h.hour;
                }
            }
        }

        return { highCount, mediumCount, lowCount, peakDay, peakHour, peakVal };
    }, [data]);

    // Generate hour labels (only show some to avoid clutter)
    const hourLabels = Array.from({ length: 24 }, (_, i) => {
        const h = i % 12 || 12;
        const ampm = i < 12 ? "A" : "P";
        return `${h}${ampm}`;
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-primary" />
                        Demand Forecast
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Predicted hourly demand based on historical booking data
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={days} onValueChange={setDays}>
                        <SelectTrigger className="w-40">
                            <CalendarDays className="mr-2 h-4 w-4" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="14">Last 14 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="60">Last 60 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fetchForecast(true)}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            {summaryStats && (
                <div className="grid gap-4 md:grid-cols-3">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2.5 rounded-lg bg-red-500/10">
                                        <TrendingUp className="h-5 w-5 text-red-500" />
                                    </div>
                                    <Badge variant="destructive">{summaryStats.highCount} slots</Badge>
                                </div>
                                <div className="text-2xl font-bold">
                                    {summaryStats.peakDay} {summaryStats.peakHour}:00
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Peak demand ({summaryStats.peakVal.toFixed(1)} avg bookings)
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2.5 rounded-lg bg-primary/10">
                                        <BarChart3 className="h-5 w-5 text-primary" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold">
                                    {data?.totalBookingsAnalyzed ?? 0}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Total bookings analyzed over {data?.periodDays} days
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2.5 rounded-lg bg-amber-500/10">
                                        <Clock className="h-5 w-5 text-amber-500" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold flex items-center gap-3">
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 rounded-sm bg-red-500/40" /> {summaryStats.highCount}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 rounded-sm bg-amber-500/40" /> {summaryStats.mediumCount}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 rounded-sm bg-emerald-500/40" /> {summaryStats.lowCount}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    High / Medium / Low demand slots
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            )}

            {/* Heatmap Grid */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Weekly Demand Heatmap
                    </CardTitle>
                    <CardDescription>
                        Each cell shows average bookings per hour. Hover for details.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Hour labels row */}
                            <div className="flex gap-[2px] mb-1 ml-[88px]">
                                {hourLabels.map((label, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 text-center text-[10px] text-muted-foreground font-mono"
                                    >
                                        {i % 3 === 0 ? label : ""}
                                    </div>
                                ))}
                            </div>

                            {/* Day rows */}
                            {data?.forecast.map((day, dayIdx) => (
                                <motion.div
                                    key={day.dayOfWeek}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: dayIdx * 0.05 }}
                                    className="flex items-center gap-[2px] mb-[2px]"
                                >
                                    {/* Day label */}
                                    <div className="w-[84px] text-sm font-medium text-right pr-2 shrink-0">
                                        {day.dayName.substring(0, 3)}
                                    </div>

                                    {/* Hour cells */}
                                    {day.hourlyDemand.map((hour) => {
                                        const isHovered =
                                            hoveredCell?.day === day.dayOfWeek && hoveredCell?.hour === hour.hour;

                                        return (
                                            <div
                                                key={hour.hour}
                                                className={`
                          flex-1 aspect-square rounded-[3px] cursor-pointer transition-all duration-150 relative
                          ${getIntensityStyle(hour.avgBookings, maxAvg, hour.peakLabel)}
                          ${isHovered ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-125 z-10" : ""}
                        `}
                                                onMouseEnter={() => setHoveredCell({ day: day.dayOfWeek, hour: hour.hour })}
                                                onMouseLeave={() => setHoveredCell(null)}
                                            >
                                                {/* Tooltip */}
                                                {isHovered && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                                                        <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                                                            <div className="font-semibold">
                                                                {day.dayName} {hour.hour}:00–{hour.hour + 1}:00
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span>Avg: <strong>{hour.avgBookings}</strong> bookings</span>
                                                                <Badge
                                                                    variant={
                                                                        hour.peakLabel === "HIGH"
                                                                            ? "destructive"
                                                                            : hour.peakLabel === "MEDIUM"
                                                                                ? "warning"
                                                                                : "success"
                                                                    }
                                                                    className="text-[10px] px-1.5 py-0"
                                                                >
                                                                    {hour.peakLabel}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="w-2 h-2 bg-popover border-b border-r transform rotate-45 mx-auto -mt-1" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-6 flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="font-medium">Demand Level:</span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-3 w-6 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
                                Low
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-3 w-6 rounded-sm bg-amber-500/30 border border-amber-500/30" />
                                Medium
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-3 w-6 rounded-sm bg-red-500/35 border border-red-500/30" />
                                High
                            </span>
                        </div>
                        {data?.generatedAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                Generated: {new Date(data.generatedAt).toLocaleString()}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
