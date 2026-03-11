import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function test() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error("No RESEND_API_KEY found in .env");
        process.exit(1);
    }

    const resend = new Resend(apiKey);

    try {
        const { data, error } = await resend.emails.send({
            from: 'Acme <onboarding@resend.dev>',
            to: [process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || 'test@example.com'], // using the gmail they previously used
            subject: "Test Email from CampusRes via Resend",
            html: "<p>This is a test email to verify the Resend integration.</p>",
        });

        if (error) {
            console.error("Resend API error:", error);
        } else {
            console.log("Email sent successfully via Resend API:", data);
        }
    } catch (e) {
        console.error("Email send failed with exception:");
        console.error(e);
    }
}

test();
