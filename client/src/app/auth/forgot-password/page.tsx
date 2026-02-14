import { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
    title: "Forgot Password | CampusRes",
    description: "Reset your CampusRes account password",
};

export default function ForgotPasswordPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
            <ForgotPasswordForm />
        </div>
    );
}
