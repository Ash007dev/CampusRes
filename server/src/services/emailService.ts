/**
 * =============================================================================
 * Campus Resource Engine - Email Service
 * =============================================================================
 * Handles sending emails using nodemailer (OTP, notifications, etc.)
 * Features premium FAANG-level email template styling
 * =============================================================================
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }
  return transporter;
}

// Common FAANG-style CSS for all emails
const BASE_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'; margin: 0; padding: 0; background-color: #f8fafc; -webkit-font-smoothing: antialiased; }
  .container { max-width: 600px; margin: 40px auto; padding: 20px; }
  .card { background: #ffffff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; }
  .header { margin-bottom: 32px; text-align: center; }
  .logo { font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; }
  .logo span { color: #3b82f6; }
  .title { font-size: 24px; font-weight: 600; color: #0f172a; margin: 0 0 24px 0; text-align: center; letter-spacing: -0.5px; }
  .message { color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; }
  .greeting { font-weight: 600; color: #0f172a; }
  .highlight-box { background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center; margin: 32px 0; border: 1px solid #e2e8f0; }
  .otp-code { font-size: 42px; font-weight: 700; letter-spacing: 12px; color: #0f172a; margin: 0; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-weight: 600; font-size: 13px; margin: 24px 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-approved { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .status-rejected { background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  .status-warning { background-color: #fff7ed; color: #9a3412; border: 1px solid #ffedd5; }
  .status-info { background-color: #eff6ff; color: #1e40af; border: 1px solid #dbeafe; }
  .details-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  .details-table td { padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px; }
  .details-table tr:last-child td { border-bottom: none; }
  .detail-label { color: #64748b; font-weight: 500; width: 35%; }
  .detail-value { color: #0f172a; font-weight: 600; text-align: right; }
  .footer { text-align: center; margin-top: 48px; padding-top: 32px; border-top: 1px solid #f1f5f9; }
  .footer-text { color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0 0 8px 0; }
  .muted-text { color: #64748b; font-size: 14px; text-align: center; margin-top: 24px; }
`;

export async function sendOtpEmail(email: string, otp: string, userName: string): Promise<boolean> {
  const subject = 'Your Verification Code - CampusRes';
  const htmlContent = `<!DOCTYPE html><html><head><style>${BASE_CSS}</style></head>
    <body><div class="container"><div class="card">
      <div class="header"><div class="logo">Campus<span>Res</span></div></div>
      <h1 class="title">Verify your identity</h1>
      <p class="message"><span class="greeting">Hi ${userName},</span><br><br>We received a request to log in to your CampusRes account. Enter the following verification code to access your account:</p>
      <div class="highlight-box"><div class="otp-code">${otp}</div></div>
      <p class="muted-text">This code will expire in <strong>5 minutes</strong>.</p>
      <div class="footer">
        <p class="footer-text">If you didn't request this email, there's nothing to worry about — you can safely ignore it.</p>
        <p class="footer-text">&copy; ${new Date().getFullYear()} Campus Resource Engine. All rights reserved.</p>
      </div>
    </div></div></body></html>`;

  return sendEmail(email, subject, htmlContent, otp, 'OTP');
}

export async function sendPasswordResetOtpEmail(email: string, otp: string, userName: string): Promise<boolean> {
  const subject = 'Reset Your Password - CampusRes';
  const htmlContent = `<!DOCTYPE html><html><head><style>${BASE_CSS}</style></head>
    <body><div class="container"><div class="card">
      <div class="header"><div class="logo">Campus<span>Res</span></div></div>
      <h1 class="title">Password Reset Request</h1>
      <p class="message"><span class="greeting">Hi ${userName},</span><br><br>We received a request to reset the password for your CampusRes account. Use the verification code below to set up a new password:</p>
      <div class="highlight-box"><div class="otp-code">${otp}</div></div>
      <p class="muted-text">This code will expire in <strong>5 minutes</strong>.</p>
      <div class="footer">
        <p class="footer-text">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        <p class="footer-text">&copy; ${new Date().getFullYear()} Campus Resource Engine.</p>
      </div>
    </div></div></body></html>`;

  return sendEmail(email, subject, htmlContent, otp, 'Password Reset');
}

export async function sendBookingStatusEmail(
  email: string, userName: string, details: { roomName: string; startTime: string; endTime: string; status: 'CONFIRMED' | 'REJECTED'; reason?: string; }
): Promise<boolean> {
  const isApproved = details.status === 'CONFIRMED';
  const subject = `Booking ${isApproved ? 'Approved' : 'Rejected'}: ${details.roomName}`;

  const htmlContent = `<!DOCTYPE html><html><head><style>${BASE_CSS}</style></head>
    <body><div class="container"><div class="card">
      <div class="header"><div class="logo">Campus<span>Res</span></div></div>
      <h1 class="title">Booking ${isApproved ? 'Approved' : 'Rejected'}</h1>
      <p class="message"><span class="greeting">Hi ${userName},</span><br><br>Your recent booking request has been ${isApproved ? 'approved and confirmed' : 'declined'}.</p>
      <div style="text-align: center;">
        <div class="status-badge ${isApproved ? 'status-approved' : 'status-rejected'}">${details.status}</div>
      </div>
      <table class="details-table">
        <tr><td class="detail-label">Room</td><td class="detail-value">${details.roomName}</td></tr>
        <tr><td class="detail-label">Date & Time</td><td class="detail-value">${new Date(details.startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
        <tr><td class="detail-label">Until</td><td class="detail-value">${new Date(details.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td></tr>
        ${!isApproved && details.reason ? `<tr><td class="detail-label">Reason</td><td class="detail-value" style="color:#ef4444;">${details.reason}</td></tr>` : ''}
      </table>
      ${isApproved ? '<p class="muted-text">You must physically check-in within 15 minutes of your start time by scanning the room QR code.</p>' : ''}
      <div class="footer"><p class="footer-text">&copy; ${new Date().getFullYear()} Campus Resource Engine.</p></div>
    </div></div></body></html>`;

  return sendEmail(email, subject, htmlContent, null, 'Booking Status');
}

export async function sendBookingCancellationEmail(
  email: string, userName: string, details: { roomName: string; startTime: string; endTime: string; reason?: string; }
): Promise<boolean> {
  const subject = `Booking Cancelled by Admin: ${details.roomName}`;
  const htmlContent = `<!DOCTYPE html><html><head><style>${BASE_CSS}</style></head>
    <body><div class="container"><div class="card">
      <div class="header"><div class="logo">Campus<span>Res</span></div></div>
      <h1 class="title">Booking Cancelled</h1>
      <p class="message"><span class="greeting">Hi ${userName},</span><br><br>Your upcoming booking has been cancelled by an administrator. Any credits used have been fully refunded to your account.</p>
      <div style="text-align: center;"><div class="status-badge status-rejected">CANCELLED</div></div>
      <table class="details-table">
        <tr><td class="detail-label">Room</td><td class="detail-value">${details.roomName}</td></tr>
        <tr><td class="detail-label">Date</td><td class="detail-value">${new Date(details.startTime).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</td></tr>
        ${details.reason ? `<tr><td class="detail-label">Reason</td><td class="detail-value">${details.reason}</td></tr>` : ''}
      </table>
      <div class="footer"><p class="footer-text">&copy; ${new Date().getFullYear()} Campus Resource Engine.</p></div>
    </div></div></body></html>`;

  return sendEmail(email, subject, htmlContent, null, 'Admin Cancellation');
}

export async function sendBookingReminderEmail(
  email: string, userName: string, details: { bookingId: string; roomName: string; roomCode?: string; startTime: string; endTime: string; }
): Promise<boolean> {
  const subject = `Starting Soon: ${details.roomName}`;
  const htmlContent = `<!DOCTYPE html><html><head><style>${BASE_CSS}</style></head>
    <body><div class="container"><div class="card">
      <div class="header"><div class="logo">Campus<span>Res</span></div></div>
      <h1 class="title">Your booking is starting</h1>
      <p class="message"><span class="greeting">Hi ${userName},</span><br><br>Your reservation for <strong>${details.roomName}</strong> ${details.roomCode ? `(${details.roomCode})` : ''} begins in <strong>5 minutes</strong>.</p>
      <div style="text-align: center;"><div class="status-badge status-warning">Action Required</div></div>
      <div class="highlight-box" style="padding: 24px;">
        <h3 style="margin:0 0 8px 0; color:#0f172a; font-size:18px;">How to check in</h3>
        <p style="margin:0; color:#475569; font-size:15px; line-height:1.5;">Scan the QR code located outside the room using your CampusRes mobile app. You have a 15-minute grace period before the booking is marked as a no-show.</p>
      </div>
      <div class="footer"><p class="footer-text">&copy; ${new Date().getFullYear()} Campus Resource Engine.</p></div>
    </div></div></body></html>`;

  return sendEmail(email, subject, htmlContent, null, 'Booking Reminder');
}

export async function sendBroadcastEmail(
  email: string, userName: string, details: { subject: string; message: string; }
): Promise<boolean> {
  const subject = `${details.subject} - CampusRes`;
  const htmlContent = `<!DOCTYPE html><html><head><style>${BASE_CSS}</style></head>
    <body><div class="container"><div class="card">
      <div class="header"><div class="logo">Campus<span>Res</span></div></div>
      <h1 class="title">${details.subject}</h1>
      <p class="message"><span class="greeting">Hi ${userName},</span></p>
      <div class="message" style="white-space: pre-wrap; margin-top: 16px;">${details.message}</div>
      <div class="footer">
        <p class="footer-text">This is an official broadcast from the CampusRes administration.</p>
        <p class="footer-text">&copy; ${new Date().getFullYear()} Campus Resource Engine.</p>
      </div>
    </div></div></body></html>`;

  return sendEmail(email, subject, htmlContent, null, 'Admin Broadcast');
}

// Internal standard sender function
async function sendEmail(to: string, subject: string, html: string, codeForTesting: string | null, type: string): Promise<boolean> {
  // Strip HTML for fallback text version easily
  const text = html.replace(/<[^>]*>?/gm, '\n').replace(/\n\s*\n/g, '\n\n').trim();

  try {
    if (config.nodeEnv === 'development') {
      logger.info({ email: to, type }, `📧 ${type} email simulated`);
      if (codeForTesting) {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log(`║  Email: ${to.padEnd(48)} ║`);
        console.log(`║  Code:  ${codeForTesting.padEnd(48)} ║`);
        console.log('╚════════════════════════════════════════════════════════════╝\n');
      }
    }

    if (!config.email.user || !config.email.password) return true;

    await getTransporter().sendMail({
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    logger.error({ email: to, error }, `Failed to send ${type} email`);
    return false;
  }
}

/**
 * Send waitlist notification email (Room slot is now available)
 */
export async function sendWaitlistNotificationEmail(
  email: string,
  userName: string,
  details: {
    roomName: string;
    availableStartTime: string;
    availableEndTime: string;
  }
): Promise<boolean> {
  const subject = `🔔 Room Available! ${details.roomName} is now free`;

  const startStr = new Date(details.availableStartTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const endStr = new Date(details.availableEndTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; font-size: 14px; margin: 20px 0; background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .details-box { background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #86efac; }
        .detail-item { margin-bottom: 8px; font-size: 14px; }
        .detail-label { font-weight: bold; color: #64748b; width: 100px; display: inline-block; }
        .message { color: #334155; line-height: 1.6; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; }
        .action-box { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; color: #1e40af; text-align: center; }
        .hurry { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 15px; font-size: 13px; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🏛️ Campus Resource Engine</div>
          </div>
          
          <p class="message">Hello <strong>${userName}</strong>,</p>
          
          <p class="message">Great news! A room you were waiting for is now <strong>available</strong>. Log in quickly to book it before someone else does!</p>
          
          <div style="text-align: center;">
            <div class="status-badge">🔔 ROOM AVAILABLE</div>
          </div>
          
          <div class="details-box">
            <div class="detail-item"><span class="detail-label">Room:</span> <span>${details.roomName}</span></div>
            <div class="detail-item"><span class="detail-label">From:</span> <span>${startStr}</span></div>
            <div class="detail-item"><span class="detail-label">To:</span> <span>${endStr}</span></div>
          </div>
          
          <div class="action-box">
            🚀 <strong>Log in to CampusRes now</strong> to book this room before it's taken!
          </div>

          <div class="hurry">
            ⚡ Act fast — slots fill up quickly. This notification has been sent to all users on the waitlist.
          </div>
          
          <div class="footer">
            <p>This is an automated message from Campus Resource Engine.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${userName},

Great news! A room you were waiting for is now AVAILABLE.

Room: ${details.roomName}
From: ${startStr}
To:   ${endStr}

Log in to CampusRes now to book this room before it's taken!

Act fast — slots fill up quickly.

- Campus Resource Engine
  `;

  try {
    if (config.nodeEnv === 'development') {
      logger.info({ email, roomName: details.roomName }, '📧 Waitlist Notification email logged for development');
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║            🔔 WAITLIST SLOT AVAILABLE                      ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  To: ${email.padEnd(51)} ║`);
      console.log(`║  Room: ${(details.roomName || '').padEnd(49)} ║`);
      console.log(`║  From: ${startStr.substring(0, 49).padEnd(49)} ║`);
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n');
    }

    if (!config.email.user || !config.email.password) {
      return true;
    }

    await getTransporter().sendMail({
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    logger.info({ email, roomName: details.roomName }, 'Waitlist notification email sent');
    return true;
  } catch (error) {
    logger.error({ email, error }, 'Failed to send waitlist notification email');
    return false;
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (!config.email.user || !config.email.password) return false;
    await getTransporter().verify();
    return true;
  } catch (error) {
    logger.error({ error }, 'SMTP connection failed');
    return false;
  }
}

export const emailService = {
  sendOtpEmail,
  sendPasswordResetOtpEmail,
  sendBookingStatusEmail,
  sendBookingCancellationEmail,
  sendBookingReminderEmail,
  sendBroadcastEmail,
  sendWaitlistNotificationEmail,
  verifyEmailConnection,
};
