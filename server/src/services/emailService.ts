/**
 * =============================================================================
 * Campus Resource Engine - Email Service
 * =============================================================================
 * Handles sending emails using nodemailer (OTP, notifications, etc.)
 * =============================================================================
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Lazy-initialized email transporter
 */
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

/**
 * Send OTP email for MFA verification
 */
export async function sendOtpEmail(
  email: string,
  otp: string,
  userName: string
): Promise<boolean> {
  const subject = 'Your Login Verification Code - Campus Resource Engine';

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
        .otp-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 25px; text-align: center; margin: 30px 0; }
        .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: white; }
        .message { color: #666; line-height: 1.6; margin-bottom: 20px; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; color: #856404; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🏛️ Campus Resource Engine</div>
          </div>
          
          <p class="message">Hello <strong>${userName}</strong>,</p>
          
          <p class="message">You are attempting to log in to your Campus Resource Engine account. Please use the following verification code to complete your login:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          
          <p class="message">This code will expire in <strong>5 minutes</strong>.</p>
          
          <div class="warning">
            ⚠️ If you did not request this code, please ignore this email. Someone may have entered your email address by mistake.
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

You are attempting to log in to your Campus Resource Engine account.

Your verification code is: ${otp}

This code will expire in 5 minutes.

If you did not request this code, please ignore this email.

- Campus Resource Engine
  `;

  try {
    // In development, log the OTP for testing
    if (config.nodeEnv === 'development') {
      logger.info({ email, otp }, '📧 OTP for development testing');
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                    🔐 OTP VERIFICATION CODE                ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  Email: ${email.padEnd(48)} ║`);
      console.log(`║  OTP Code: ${otp.padEnd(45)} ║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  ⚠️  SMTP not configured - Check this terminal for OTP    ║');
      console.log('║  📋 Copy the OTP code above and paste it in your app      ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n');
    }

    // Skip actual email sending if SMTP is not configured
    if (!config.email.user || !config.email.password) {
      logger.warn({ email }, 'SMTP not configured, skipping email send. OTP logged above for testing.');
      return true; // Return true so login flow continues
    }

    await getTransporter().sendMail({
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    logger.info({ email }, 'OTP email sent successfully');
    return true;
  } catch (error) {
    logger.error({ email, error }, 'Failed to send OTP email');
    return false;
  }
}

/**
 * Send booking status notification email (Approved/Rejected)
 */
export async function sendBookingStatusEmail(
  email: string,
  userName: string,
  bookingDetails: {
    roomName: string;
    startTime: string;
    endTime: string;
    status: 'CONFIRMED' | 'REJECTED';
    reason?: string;
  }
): Promise<boolean> {
  const isApproved = bookingDetails.status === 'CONFIRMED';
  const subject = `Booking ${isApproved ? 'Approved' : 'Rejected'} - ${bookingDetails.roomName}`;
  const statusColor = isApproved ? '#10b981' : '#ef4444';

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
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; font-size: 14px; margin: 20px 0; background-color: ${statusColor}; }
        .details-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
        .detail-item { margin-bottom: 8px; font-size: 14px; }
        .detail-label { font-weight: bold; color: #64748b; width: 100px; display: inline-block; }
        .message { color: #334155; line-height: 1.6; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🏛️ Campus Resource Engine</div>
          </div>
          
          <p class="message">Hello <strong>${userName}</strong>,</p>
          
          <p class="message">Your booking request for <strong>${bookingDetails.roomName}</strong> has been <strong>${isApproved ? 'APPROVED' : 'REJECTED'}</strong>.</p>
          
          <div style="text-align: center;">
            <div class="status-badge">${isApproved ? 'APPROVED' : 'REJECTED'}</div>
          </div>
          
          <div class="details-box">
            <div class="detail-item"><span class="detail-label">Room:</span> <span>${bookingDetails.roomName}</span></div>
            <div class="detail-item"><span class="detail-label">Start:</span> <span>${new Date(bookingDetails.startTime).toLocaleString()}</span></div>
            <div class="detail-item"><span class="detail-label">End:</span> <span>${new Date(bookingDetails.endTime).toLocaleString()}</span></div>
            ${!isApproved && bookingDetails.reason ? `<div class="detail-item"><span class="detail-label">Reason:</span> <span>${bookingDetails.reason}</span></div>` : ''}
          </div>
          
          ${isApproved ? '<p class="message">Please remember to check in using the QR code at the room within 15 minutes of your start time.</p>' : ''}
          
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

Your booking request for ${bookingDetails.roomName} has been ${isApproved ? 'APPROVED' : 'REJECTED'}.

Booking Details:
- Room: ${bookingDetails.roomName}
- Start: ${new Date(bookingDetails.startTime).toLocaleString()}
- End: ${new Date(bookingDetails.endTime).toLocaleString()}
${!isApproved && bookingDetails.reason ? `- Reason: ${bookingDetails.reason}` : ''}

${isApproved ? 'Please remember to check in using the QR code at the room.' : ''}

- Campus Resource Engine
  `;

  try {
    if (config.nodeEnv === 'development') {
      logger.info({ email, status: bookingDetails.status }, '📧 Booking Status email logged for development');
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

    return true;
  } catch (error) {
    logger.error({ email, error }, 'Failed to send booking status email');
    return false;
  }
}

/**
 * Send OTP email for password reset
 */
export async function sendPasswordResetOtpEmail(
  email: string,
  otp: string,
  userName: string
): Promise<boolean> {
  const subject = 'Password Reset Code - Campus Resource Engine';

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
        .otp-box { background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); border-radius: 10px; padding: 25px; text-align: center; margin: 30px 0; }
        .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: white; }
        .message { color: #666; line-height: 1.6; margin-bottom: 20px; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        .warning { background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🏛️ Campus Resource Engine</div>
          </div>
          
          <p class="message">Hello <strong>${userName}</strong>,</p>
          
          <p class="message">We received a request to reset your password. Use the following code to proceed:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          
          <p class="message">This code will expire in <strong>5 minutes</strong>.</p>
          
          <div class="warning">
            🔒 If you did not request a password reset, please ignore this email and ensure your account is secure.
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

We received a request to reset your password.

Your password reset code is: ${otp}

This code will expire in 5 minutes.

If you did not request a password reset, please ignore this email.

- Campus Resource Engine
  `;

  try {
    if (config.nodeEnv === 'development') {
      logger.info({ email, otp }, '📧 Password Reset OTP for development testing');
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║              🔐 PASSWORD RESET OTP CODE                   ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  Email: ${email.padEnd(48)} ║`);
      console.log(`║  OTP Code: ${otp.padEnd(45)} ║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  ⚠️  Copy the OTP code above and paste it in your app      ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n');
    }

    if (!config.email.user || !config.email.password) {
      logger.warn({ email }, 'SMTP not configured, skipping email send. OTP logged above for testing.');
      return true;
    }

    await getTransporter().sendMail({
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    logger.info({ email }, 'Password reset OTP email sent successfully');
    return true;
  } catch (error) {
    logger.error({ email, error }, 'Failed to send password reset OTP email');
    return false;
  }
}

/**
 * Send booking cancellation notification email (Admin cancelled user's booking)
 */
export async function sendBookingCancellationEmail(
  email: string,
  userName: string,
  bookingDetails: {
    roomName: string;
    startTime: string;
    endTime: string;
    reason?: string;
    cancelledBy?: string;
  }
): Promise<boolean> {
  const subject = `Booking Cancelled by Administrator - ${bookingDetails.roomName}`;

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
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; font-size: 14px; margin: 20px 0; background-color: #ef4444; }
        .details-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
        .detail-item { margin-bottom: 8px; font-size: 14px; }
        .detail-label { font-weight: bold; color: #64748b; width: 100px; display: inline-block; }
        .message { color: #334155; line-height: 1.6; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; }
        .action-box { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; color: #1e40af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🏛️ Campus Resource Engine</div>
          </div>
          
          <p class="message">Hello <strong>${userName}</strong>,</p>
          
          <p class="message">Your booking for <strong>${bookingDetails.roomName}</strong> has been <strong>cancelled by an administrator</strong>.</p>
          
          <div style="text-align: center;">
            <div class="status-badge">CANCELLED BY ADMIN</div>
          </div>
          
          <div class="details-box">
            <div class="detail-item"><span class="detail-label">Room:</span> <span>${bookingDetails.roomName}</span></div>
            <div class="detail-item"><span class="detail-label">Start:</span> <span>${new Date(bookingDetails.startTime).toLocaleString()}</span></div>
            <div class="detail-item"><span class="detail-label">End:</span> <span>${new Date(bookingDetails.endTime).toLocaleString()}</span></div>
            ${bookingDetails.reason ? `<div class="detail-item"><span class="detail-label">Reason:</span> <span>${bookingDetails.reason}</span></div>` : ''}
          </div>
          
          <div class="action-box">
            💡 Your credits have been refunded. You can book another room from the dashboard.
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

Your booking for ${bookingDetails.roomName} has been CANCELLED by an administrator.

Booking Details:
- Room: ${bookingDetails.roomName}
- Start: ${new Date(bookingDetails.startTime).toLocaleString()}
- End: ${new Date(bookingDetails.endTime).toLocaleString()}
${bookingDetails.reason ? `- Reason: ${bookingDetails.reason}` : ''}

Your credits have been refunded. You can book another room from the dashboard.

- Campus Resource Engine
  `;

  try {
    if (config.nodeEnv === 'development') {
      logger.info({ email, roomName: bookingDetails.roomName, reason: bookingDetails.reason }, '📧 Admin Cancellation email logged for development');
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║            ❌ ADMIN BOOKING CANCELLATION                   ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  To: ${email.padEnd(51)} ║`);
      console.log(`║  Room: ${(bookingDetails.roomName || '').padEnd(49)} ║`);
      console.log(`║  Reason: ${(bookingDetails.reason || 'No reason provided').padEnd(47)} ║`);
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

    return true;
  } catch (error) {
    logger.error({ email, error }, 'Failed to send booking cancellation email');
    return false;
  }
}

/**
 * Send booking reminder email (5 minutes before booking starts)
 */
export async function sendBookingReminderEmail(
  email: string,
  userName: string,
  bookingDetails: {
    bookingId: string;
    roomName: string;
    roomCode?: string;
    startTime: string;
    endTime: string;
  }
): Promise<boolean> {
  const subject = `⏰ Reminder: Your booking starts soon - ${bookingDetails.roomName}`;

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
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; font-size: 14px; margin: 20px 0; background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); }
        .details-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
        .detail-item { margin-bottom: 8px; font-size: 14px; }
        .detail-label { font-weight: bold; color: #64748b; width: 100px; display: inline-block; }
        .message { color: #334155; line-height: 1.6; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; }
        .checkin-box { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; color: #065f46; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🏛️ Campus Resource Engine</div>
          </div>
          
          <p class="message">Hello <strong>${userName}</strong>,</p>
          
          <p class="message">Your booking is starting in <strong>5 minutes</strong>! Please head to the room and check in using the QR code.</p>
          
          <div style="text-align: center;">
            <div class="status-badge">⏰ STARTS SOON</div>
          </div>
          
          <div class="details-box">
            <div class="detail-item"><span class="detail-label">Room:</span> <span>${bookingDetails.roomName}${bookingDetails.roomCode ? ` (${bookingDetails.roomCode})` : ''}</span></div>
            <div class="detail-item"><span class="detail-label">Start:</span> <span>${new Date(bookingDetails.startTime).toLocaleString()}</span></div>
            <div class="detail-item"><span class="detail-label">End:</span> <span>${new Date(bookingDetails.endTime).toLocaleString()}</span></div>
            <div class="detail-item"><span class="detail-label">Booking ID:</span> <span>${bookingDetails.bookingId}</span></div>
          </div>
          
          <div class="checkin-box">
            📱 <strong>Scan the QR code at the room to check in.</strong><br>
            You have a 15-minute grace period after the start time.
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

Your booking is starting in 5 minutes! Please head to the room and check in.

Booking Details:
- Room: ${bookingDetails.roomName}${bookingDetails.roomCode ? ` (${bookingDetails.roomCode})` : ''}
- Start: ${new Date(bookingDetails.startTime).toLocaleString()}
- End: ${new Date(bookingDetails.endTime).toLocaleString()}
- Booking ID: ${bookingDetails.bookingId}

Scan the QR code at the room to check in. You have a 15-minute grace period.

- Campus Resource Engine
  `;

  try {
    if (config.nodeEnv === 'development') {
      logger.info({ email, roomName: bookingDetails.roomName, bookingId: bookingDetails.bookingId }, '📧 Booking Reminder email logged for development');
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║            ⏰ BOOKING REMINDER                             ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  To: ${email.padEnd(51)} ║`);
      console.log(`║  Room: ${(bookingDetails.roomName || '').padEnd(49)} ║`);
      console.log(`║  Starts: ${new Date(bookingDetails.startTime).toLocaleString().padEnd(47)} ║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  📱 Remember to scan QR code to check in!                 ║');
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

    return true;
  } catch (error) {
    logger.error({ email, error }, 'Failed to send booking reminder email');
    return false;
  }
}

/**
 * Send broadcast email from admin to a user
 */
export async function sendBroadcastEmail(
  email: string,
  userName: string,
  broadcastDetails: {
    subject: string;
    message: string;
  }
): Promise<boolean> {
  const subject = `📢 ${broadcastDetails.subject} - CampusRes`;

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
        .badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; font-size: 14px; margin: 20px 0; background-color: #3b82f6; }
        .message-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .message-text { color: #334155; line-height: 1.8; font-size: 15px; white-space: pre-wrap; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🏛️ Campus Resource Engine</div>
          </div>
          
          <p style="color: #334155; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
          
          <div style="text-align: center;">
            <div class="badge">📢 ADMIN BROADCAST</div>
          </div>
          
          <div class="message-box">
            <p class="message-text">${broadcastDetails.message}</p>
          </div>
          
          <div class="footer">
            <p>This is an official broadcast from the CampusRes administration.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${userName},

--- ADMIN BROADCAST ---
${broadcastDetails.subject}

${broadcastDetails.message}

- CampusRes Administration
  `;

  try {
    if (config.nodeEnv === 'development') {
      logger.info({ email, subject: broadcastDetails.subject }, '📢 Broadcast email logged for development');
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║            📢 ADMIN BROADCAST EMAIL                        ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  To: ${email.padEnd(51)} ║`);
      console.log(`║  Subject: ${broadcastDetails.subject.substring(0, 46).padEnd(46)} ║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  ${broadcastDetails.message.substring(0, 55).padEnd(55)} ║`);
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

    return true;
  } catch (error) {
    logger.error({ email, error }, 'Failed to send broadcast email');
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
    if (!config.email.user || !config.email.password) {
      logger.warn('SMTP credentials not configured');
      return false;
    }
    await getTransporter().verify();
    logger.info('SMTP connection verified');
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
