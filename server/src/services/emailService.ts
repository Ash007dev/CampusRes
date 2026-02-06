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
  verifyEmailConnection,
};
