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
  sendBookingStatusEmail,
  verifyEmailConnection,
};
