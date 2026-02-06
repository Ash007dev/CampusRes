"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
    ChevronLeft,
    Users,
    MapPin,
    Building,
    Calendar,
    Clock,
    Wifi,
    Monitor,
    Wind,
    Mic,
    Video,
    Loader2,
    Star,
    CheckCircle,
    AlertTriangle,
    Wrench,
    MessageSquarePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { roomsApi, bookingsApi, type Room } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { BookingModal, type BookingFormData } from "@/components/booking/BookingModal";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SubmitFeedbackModal } from "@/components/feedback/SubmitFeedbackModal";

const AMENITY_ICONS: Record<string, React.ElementType> = {
    wifi: Wifi,
    projector: Monitor,
    ac: Wind,
    microphone: Mic,
    video_conference: Video,
    whiteboard: Monitor,
    speakers: Mic,
};

const AMENITY_LABELS: Record<string, string> = {
    wifi: "WiFi",
    projector: "Projector",
    ac: "Air Conditioning",
    microphone: "Microphone",
    video_conference: "Video Conference",
    whiteboard: "Whiteboard",
    speakers: "Speakers",
};

export default function RoomDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const roomId = params.id as string;
    const { user, isLoading: authLoading } = useAuth();
    const { toast } = useToast();

    const [room, setRoom] = useState<Room | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isBooking, setIsBooking] = useState(false);

    // Fetch room details
    const fetchRoom = useCallback(async () => {
        try {
            const response = await roomsApi.getById(roomId);
            setRoom(response.data.data);
        } catch (error) {
            console.error("Failed to fetch room:", error);
            toast({
                title: "Error",
                description: "Failed to load room details.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [roomId, toast]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/auth/login");
            return;
        }
        if (roomId) {
            fetchRoom();
        }
    }, [user, authLoading, router, roomId, fetchRoom]);

    // Handle booking submission
    const handleBookingSubmit = async (data: BookingFormData & { roomId: string }) => {
        setIsBooking(true);
        try {
            const startDateTime = new Date(data.date);
            const [startHour, startMin] = data.startTime.split(":").map(Number);
            startDateTime.setHours(startHour, startMin, 0, 0);

            const endDateTime = new Date(data.date);
            const [endHour, endMin] = data.endTime.split(":").map(Number);
            endDateTime.setHours(endHour, endMin, 0, 0);

            await bookingsApi.create({
                roomId: data.roomId,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                title: data.purpose,
                description: data.purpose,
            });

            toast({
                title: "Booking Successful!",
                description: `You have booked ${room?.name} for ${format(startDateTime, "PPP")}`,
            });

            setIsBookingModalOpen(false);
            router.push("/bookings");
        } catch (error: any) {
            toast({
                title: "Booking Failed",
                description: error.message || "Failed to create booking. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsBooking(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading room details...</p>
                </div>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Card className="max-w-md">
                    <CardContent className="pt-6 text-center">
                        <h2 className="text-xl font-semibold">Room Not Found</h2>
                        <p className="text-muted-foreground mt-2">
                            The room you're looking for doesn't exist or has been removed.
                        </p>
                        <Button className="mt-4" onClick={() => router.push("/dashboard")}>
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Get amenities as array from object
    const amenitiesList = room.amenities
        ? Object.entries(room.amenities).filter(([_, enabled]) => enabled).map(([name]) => name)
        : [];

    // Convert API Room to RoomCard Room format for BookingModal
    const roomForModal = {
        id: room.id,
        name: room.name,
        type: room.roomType as "LAB" | "LECTURE_HALL" | "MEETING_ROOM" | "SEMINAR_ROOM" | "CONFERENCE_ROOM" || "MEETING_ROOM",
        capacity: room.capacity,
        location: `${room.building}, Floor ${room.floor}`,
        floor: String(room.floor),
        building: room.building,
        amenities: amenitiesList,
        isAvailable: !room.isMaintenance,
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <h1 className="text-xl font-semibold">Room Details</h1>
                    <ThemeToggle />
                </div>
            </header>

            <main className="container mx-auto max-w-4xl px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    {/* Room Header */}
                    <Card className="overflow-hidden">
                        {/* Room Image Placeholder */}
                        <div className="h-64 bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center relative">
                            <div className="text-center">
                                <Building className="h-16 w-16 text-primary/50 mx-auto mb-2" />
                                <span className="text-muted-foreground">Room Image</span>
                            </div>
                            {room.isMaintenance ? (
                                <Badge className="absolute top-4 right-4 bg-yellow-500">
                                    <Wrench className="mr-1 h-3 w-3" />
                                    Under Maintenance
                                </Badge>
                            ) : (
                                <Badge className="absolute top-4 right-4 bg-green-500">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Available
                                </Badge>
                            )}
                        </div>

                        {/* Maintenance Banner */}
                        {room.isMaintenance && (
                            <div className="bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-200 dark:border-yellow-800 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                    <div>
                                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                                            This room is currently under maintenance
                                        </p>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                            Bookings are temporarily unavailable. Please check back later or choose another room.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <CardContent className="pt-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">{room.name}</h2>
                                    <p className="text-muted-foreground">{room.code || `Room #${room.id.slice(0, 8)}`}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Badge variant="secondary">{room.roomType || "ROOM"}</Badge>
                                        <Badge variant="outline">
                                            <Users className="mr-1 h-3 w-3" />
                                            {room.capacity} seats
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Button 
                                        size="lg" 
                                        onClick={() => setIsBookingModalOpen(true)}
                                        disabled={room.isMaintenance}
                                    >
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {room.isMaintenance ? "Unavailable" : "Book This Room"}
                                    </Button>
                                    <SubmitFeedbackModal
                                        roomId={room.id}
                                        roomName={room.name}
                                        trigger={
                                            <Button variant="outline" size="lg">
                                                <MessageSquarePlus className="mr-2 h-4 w-4" />
                                                Report Issue
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location Info */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Card>
                            <CardContent className="pt-4 flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-3">
                                    <Building className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Building</p>
                                    <p className="font-medium">{room.building || "Main Building"}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-3">
                                    <MapPin className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Floor</p>
                                    <p className="font-medium">Floor {room.floor || "1"}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-3">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Capacity</p>
                                    <p className="font-medium">{room.capacity} people</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Amenities */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Star className="h-5 w-5" />
                                Amenities
                            </CardTitle>
                            <CardDescription>
                                Facilities available in this room
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {amenitiesList.length > 0 ? (
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                    {amenitiesList.map((amenity: string) => {
                                        const Icon = AMENITY_ICONS[amenity.toLowerCase()] || CheckCircle;
                                        const label = AMENITY_LABELS[amenity.toLowerCase()] || amenity;
                                        return (
                                            <div
                                                key={amenity}
                                                className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                                            >
                                                <div className="rounded-lg bg-primary/10 p-2">
                                                    <Icon className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="text-sm font-medium">{label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No amenities listed for this room.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Booking Rules */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Booking Rules
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Minimum booking duration: 30 minutes</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Maximum booking duration: 4 hours</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Advance booking: Up to 2 weeks</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Cancellation: Up to 1 hour before</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Book Now Button (Mobile) */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden">
                        <Button
                            size="lg"
                            className="w-full"
                            onClick={() => setIsBookingModalOpen(true)}
                        >
                            <Calendar className="mr-2 h-4 w-4" />
                            Book This Room
                        </Button>
                    </div>
                </motion.div>
            </main>

            {/* Booking Modal */}
            <BookingModal
                isOpen={isBookingModalOpen}
                onClose={() => setIsBookingModalOpen(false)}
                onSubmit={handleBookingSubmit}
                room={roomForModal}
            />
        </div>
    );
}
