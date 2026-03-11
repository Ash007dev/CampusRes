import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function test() {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"Test" <${process.env.SMTP_FROM_EMAIL}>`,
            to: process.env.SMTP_USER,
            subject: "Test Email from CampusRes",
            text: "This is a test email.",
        });
        console.log("Email sent successfully: ", info.messageId);
    } catch (e) {
        console.error("Email send failed:");
        console.error(e);
    }
}

test();
