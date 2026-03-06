"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, CheckCircle } from "lucide-react";
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

// Validation schema
const userSchema = z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    role: z.enum(["STUDENT", "FACULTY", "LAB_ADMIN", "ADMIN"]),
    departmentId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface AddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: UserFormData) => Promise<void>;
    departments?: Array<{ id: string; name: string; code: string }>;
}

const ROLES = [
    { value: "STUDENT", label: "Student" },
    { value: "FACULTY", label: "Faculty" },
    { value: "LAB_ADMIN", label: "Lab Admin" },
    { value: "ADMIN", label: "Admin" },
];

export function AddUserModal({
    isOpen,
    onClose,
    onSubmit,
    departments = [],
}: AddUserModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        formState: { errors },
    } = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            role: "STUDENT",
        },
    });

    const onFormSubmit = async (data: UserFormData) => {
        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit(data);
            setIsSuccess(true);

            // Reset and close after success animation
            setTimeout(() => {
                reset();
                setIsSuccess(false);
                onClose();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create user");
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            reset();
            setError(null);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                        Create a new user account. An email will not be sent automatically.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 mt-4">
                    {/* Success Animation */}
                    {isSuccess && (
                        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
                            <div className="animate-bounce mb-4">
                                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle className="h-10 w-10 text-green-500" />
                                </div>
                            </div>
                            <p className="text-lg font-semibold">User Created Successfully!</p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name *</Label>
                                <Input
                                    id="firstName"
                                    placeholder="John"
                                    {...register("firstName")}
                                />
                                {errors.firstName && (
                                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name *</Label>
                                <Input
                                    id="lastName"
                                    placeholder="Doe"
                                    {...register("lastName")}
                                />
                                {errors.lastName && (
                                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john.doe@campus.edu"
                                {...register("email")}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Role *</Label>
                            <Select
                                defaultValue="STUDENT"
                                onValueChange={(value) => setValue("role", value as any)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((role) => (
                                        <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.role && (
                                <p className="text-sm text-destructive">{errors.role.message}</p>
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

                        <p className="text-xs text-muted-foreground mt-4">
                            Note: A random temporary password will be generated for the user. They will need to use Forgot Password to set their own if not provided manually.
                        </p>
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
                                "Create User"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
