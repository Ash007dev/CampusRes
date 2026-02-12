/**
 * =============================================================================
 * Campus Resource Engine - Auth Service
 * =============================================================================
 * Authentication using Supabase Auth
 * Users are created in auth.users and linked to public.users
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { TIME } from '../config/constants.js';
import bcrypt from 'bcryptjs';
import {
  InvalidCredentialsError,
  UserNotFoundError,
  EmailAlreadyExistsError,
  AppError,
} from '../utils/errors.js';
import { emailService } from './emailService.js';

// Registration input interface
interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentCode?: string;
  role?: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    departmentId: string | null;
    departmentName: string | null;
  };
  tokens: {
    accessToken: string;
    refreshToken?: string;
  };
}

interface QuotaUsage {
  usedHours: number;
  limitHours: number;
  remainingHours: number;
  weekStart: string;
  weekEnd: string;
}

// MFA Login initiation result
interface LoginInitiationResult {
  requiresOtp: true;
  sessionId: string; // OTP session ID (not user ID for security)
  email: string;
  message: string;
  expiresIn: number; // Seconds until OTP expires
}

// Temporary storage for pending login sessions (before OTP verification)
// REMOVED - Now using database table 'otp_sessions' for security and scalability

/**
 * Generate a random numeric OTP
 */
function generateRandomOtp(length: number = 6): string {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

/**
 * Auth Service using Supabase Auth
 */
export class AuthService {
  /**
   * Register a new user using Supabase Auth
   */
  async register(input: RegisterUserInput): Promise<AuthResult> {
    logger.info({ email: input.email }, 'Registering new user via Supabase Auth');

    // Get department ID if code provided
    let departmentId: string | null = null;
    let departmentName: string | null = null;
    if (input.departmentCode) {
      const { data: dept } = await supabase
        .from('departments')
        .select('id, name')
        .eq('code', input.departmentCode)
        .single();

      if (dept) {
        departmentId = dept.id;
        departmentName = dept.name;
      }
    }

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: false, // Require email confirmation for security
      user_metadata: {
        first_name: input.firstName,
        last_name: input.lastName,
      },
    });

    if (authError) {
      logger.error({ error: authError }, 'Failed to create auth user');
      // Check for duplicate email
      if (authError.message.includes('already registered') ||
        authError.message.includes('already been registered') ||
        (authError as any).code === 'email_exists' ||
        (authError as any).status === 422) {
        throw new EmailAlreadyExistsError(input.email);
      }
      throw new AppError(`Failed to create user: ${authError.message}`, 500);
    }

    if (!authData.user) {
      throw new AppError('Failed to create user', 500);
    }

    const authUserId = authData.user.id;

    // Create corresponding entry in public.users table
    const now = new Date().toISOString();
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUserId, // Use same ID as auth.users
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        role: input.role || 'STUDENT',
        department_id: departmentId,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (userError || !user) {
      logger.error({ error: userError }, 'Failed to create public user');
      // Cleanup: delete auth user if public user creation fails
      await supabase.auth.admin.deleteUser(authUserId);
      throw new AppError('Failed to create user profile', 500);
    }

    // Sign in to get tokens (best-effort — if this fails, user can login manually)
    let accessToken = '';
    let refreshToken = '';

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (!signInError && signInData.session) {
        accessToken = signInData.session.access_token;
        refreshToken = signInData.session.refresh_token || '';
      } else {
        logger.warn({ error: signInError }, 'Auto-login failed after registration — user must login manually');
      }
    } catch (loginErr) {
      logger.warn({ error: loginErr }, 'Auto-login failed after registration');
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'CREATE',
      entity_type: 'user',
      entity_id: user.id,
      performed_by_id: user.id,
      new_state: { email: user.email, role: user.role },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        departmentId: user.department_id,
        departmentName: departmentName,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * STEP 1: Initiate login - validate credentials and send OTP
   * SECURITY FIX: Does NOT create session until OTP is verified
   */
  async initiateLogin(
    input: { email: string; password: string },
    deviceInfo?: { fingerprint?: string; ipAddress?: string }
  ): Promise<LoginInitiationResult> {
    const { email, password } = input;
    logger.info({ email }, 'Login initiation - validating credentials');

    // CRITICAL FIX: Only validate credentials, DON'T create session yet
    // We verify password by attempting sign-in then immediately signing out
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      logger.warn({ email, error: signInError?.message }, 'Login failed - invalid credentials');
      throw new InvalidCredentialsError();
    }

    // IMMEDIATELY sign out to invalidate the session
    // User will only get real session after OTP verification
    await supabase.auth.signOut();

    // Get user profile from public.users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (userError || !user) {
      logger.error({ userId: signInData.user.id, userError }, 'User profile not found');
      throw new AppError('User profile not found', 500);
    }

    if (!user.is_active) {
      throw new AppError('Account is deactivated', 403);
    }

    if (user.blocked_until && new Date(user.blocked_until) > new Date()) {
      throw new AppError(
        `Account is blocked until ${new Date(user.blocked_until).toLocaleDateString()}`,
        403
      );
    }

    // Clean up any existing unverified OTP sessions for this user
    await supabase
      .from('otp_sessions')
      .delete()
      .eq('user_id', user.id)
      .eq('is_verified', false);

    // Generate OTP and hash it
    const otp = generateRandomOtp(6);
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + config.otp.expirySeconds * 1000);

    // Create OTP session in database with device binding
    const { data: otpSession, error: otpError } = await supabase
      .from('otp_sessions')
      .insert({
        user_id: user.id,
        email: user.email,
        otp_hash: otpHash,
        device_fingerprint: deviceInfo?.fingerprint || null,
        ip_address: deviceInfo?.ipAddress || null,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        max_attempts: 3,
        is_verified: false,
        is_locked: false,
      })
      .select('id')
      .single();

    if (otpError || !otpSession) {
      logger.error({ error: otpError }, 'Failed to create OTP session');
      throw new AppError('Failed to initiate login', 500);
    }

    // Send OTP email
    const userName = `${user.first_name} ${user.last_name}`;
    console.log(`[AuthService] 📧 Sending OTP to ${email}: ${otp}`);

    try {
      await emailService.sendOtpEmail(email, otp, userName);
      console.log(`[AuthService] ✅ OTP sent successfully`);
    } catch (emailError) {
      console.log(`[AuthService] ⚠️ Email service unavailable - OTP: ${otp}`);
      logger.warn({ error: emailError }, 'Email service unavailable');
    }

    logger.info({ email, sessionId: otpSession.id }, 'OTP session created');

    return {
      requiresOtp: true,
      sessionId: otpSession.id, // Return session ID, not user ID
      email: user.email,
      message: 'OTP has been sent to your email address',
      expiresIn: config.otp.expirySeconds,
    };
  }

  /**
   * STEP 2: Verify OTP and complete login
   * SECURITY FIX: Attempt limiting, device binding, creates session ONLY after OTP verification
   */
  async verifyLoginOtp(input: {
    sessionId: string;
    otp: string;
    deviceFingerprint?: string;
    ipAddress?: string;
  }): Promise<AuthResult> {
    const { sessionId, otp, deviceFingerprint, ipAddress } = input;
    logger.info({ sessionId }, 'Verifying login OTP');

    // Get OTP session from database
    const { data: otpSession, error: sessionError } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !otpSession) {
      logger.warn({ sessionId }, 'OTP session not found');
      throw new AppError('Invalid or expired OTP session', 400);
    }

    // Check if session is locked
    if (otpSession.is_locked) {
      logger.warn({ sessionId }, 'OTP session locked after too many failed attempts');
      throw new AppError('Too many failed attempts. Please request a new OTP.', 403);
    }

    // Check if session expired
    if (new Date(otpSession.expires_at) < new Date()) {
      await supabase.from('otp_sessions').delete().eq('id', sessionId);
      logger.warn({ sessionId }, 'OTP session expired');
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    // Check if already verified
    if (otpSession.is_verified) {
      logger.warn({ sessionId }, 'OTP already verified');
      throw new AppError('OTP already used', 400);
    }

    // Verify device fingerprint (if provided during initiation)
    if (otpSession.device_fingerprint && deviceFingerprint) {
      if (otpSession.device_fingerprint !== deviceFingerprint) {
        // Increment attempts for suspicious activity
        await supabase
          .from('otp_sessions')
          .update({ attempts: otpSession.attempts + 1 })
          .eq('id', sessionId);

        logger.warn(
          { sessionId, expected: otpSession.device_fingerprint, received: deviceFingerprint },
          'Device fingerprint mismatch'
        );
        throw new AppError('Device verification failed', 403);
      }
    }

    // Verify OTP hash
    const isValidOtp = await bcrypt.compare(otp, otpSession.otp_hash);

    if (!isValidOtp) {
      // Increment attempt counter
      const newAttempts = otpSession.attempts + 1;
      const updateData: any = { attempts: newAttempts };

      // Lock session if max attempts reached
      if (newAttempts >= otpSession.max_attempts) {
        updateData.is_locked = true;
        logger.warn({ sessionId, attempts: newAttempts }, 'OTP session locked after max attempts');
      }

      await supabase.from('otp_sessions').update(updateData).eq('id', sessionId);

      const remainingAttempts = Math.max(0, otpSession.max_attempts - newAttempts);
      throw new AppError(
        `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        400
      );
    }

    // OTP is valid - mark session as verified
    await supabase
      .from('otp_sessions')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', otpSession.user_id)
      .single();

    if (userError || !user) {
      logger.error({ userId: otpSession.user_id }, 'User not found');
      throw new AppError('User not found', 404);
    }

    // Get department name
    let departmentName: string | null = null;
    if (user.department_id) {
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', user.department_id)
        .single();
      departmentName = dept?.name || null;
    }

    // NOW create the Supabase auth session (only after OTP verification)
    // Generate a magic link and exchange it for a real session

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });

    if (linkError || !linkData) {
      logger.error({ error: linkError }, 'Failed to generate auth link');
      throw new AppError('Failed to create authentication session', 500);
    }

    // Exchange the magic link token for a real session
    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) {
      logger.error('No hashed_token in magic link response');
      throw new AppError('Failed to create authentication session', 500);
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (verifyError || !verifyData.session) {
      logger.error({ error: verifyError }, 'Failed to exchange magic link for session');
      throw new AppError('Failed to create authentication session', 500);
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'LOGIN',
      entity_type: 'user',
      entity_id: user.id,
      performed_by_id: user.id,
      metadata: { mfa_verified: true, device_fingerprint: deviceFingerprint, ip_address: ipAddress },
    });

    logger.info({ userId: user.id, email: user.email }, 'Login successful with MFA verification');

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        departmentId: user.department_id,
        departmentName: departmentName,
      },
      tokens: {
        accessToken: verifyData.session.access_token,
        refreshToken: verifyData.session.refresh_token,
      },
    };
  }

  /**
   * Legacy login method (non-MFA) - kept for backward compatibility
   * Use initiateLogin + verifyLoginOtp for MFA flow
   */
  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const { email, password } = input;
    logger.info({ email }, 'User login attempt via Supabase Auth');

    // Sign in with Supabase Auth
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session || !signInData.user) {
      logger.warn({ email, error: signInError, errorMessage: signInError?.message, errorCode: signInError?.code }, 'Login failed - Supabase Auth error');
      throw new InvalidCredentialsError();
    }

    // Get user profile from public.users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (userError || !user) {
      logger.error({ userId: signInData.user.id, userError }, 'User profile not found in public.users');
      throw new AppError('User profile not found', 500);
    }

    // Get department name if user has a department
    let departmentName: string | null = null;
    if (user.department_id) {
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', user.department_id)
        .single();
      departmentName = dept?.name || null;
    }

    if (!user.is_active) {
      throw new AppError('Account is deactivated', 403);
    }

    // Check if blocked
    if (user.blocked_until && new Date(user.blocked_until) > new Date()) {
      throw new AppError(
        `Account is blocked until ${new Date(user.blocked_until).toLocaleDateString()}`,
        403
      );
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'LOGIN',
      entity_type: 'user',
      entity_id: user.id,
      performed_by_id: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        departmentId: user.department_id,
        departmentName: departmentName,
      },
      tokens: {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    departmentId: string | null;
    departmentName: string | null;
    creditsBalance: number;
    reputationScore: number;
  } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // Get department name if user has a department
    let departmentName: string | null = null;
    if (data.department_id) {
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', data.department_id)
        .single();
      departmentName = dept?.name || null;
    }

    return {
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
      departmentId: data.department_id,
      departmentName: departmentName,
      creditsBalance: data.credits_balance,
      reputationScore: data.reputation_score,
    };
  }

  /**
   * Get user's weekly quota usage
   */
  async getUserQuotaUsage(userId: string): Promise<QuotaUsage> {
    const { data: user } = await supabase
      .from('users')
      .select('quota_limit_hours')
      .eq('id', userId)
      .single();

    const limitHours = user?.quota_limit_hours || config.booking.maxWeeklyQuotaHours;

    // Get current week boundaries
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + TIME.WEEK);

    // Get bookings for this week
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', weekStart.toISOString())
      .lte('end_time', weekEnd.toISOString())
      .not('status', 'in', '("CANCELLED","NO_SHOW")');

    // Calculate used hours
    let usedMs = 0;
    if (bookings) {
      for (const b of bookings) {
        usedMs += new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
      }
    }
    const usedHours = usedMs / TIME.HOUR;

    return {
      usedHours: parseFloat(usedHours.toFixed(2)),
      limitHours,
      remainingHours: parseFloat(Math.max(0, limitHours - usedHours).toFixed(2)),
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    };
  }

  /**
   * Change password using Supabase Auth
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user email
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Update password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      throw new AppError('Failed to update password', 500);
    }

    logger.info({ userId }, 'Password changed via Supabase Auth');
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    d.setUTCDate(diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Record<string, any>): Promise<Record<string, any>> {
    const { data: user, error } = await supabase
      .from('users')
      .update({ preferences })
      .eq('id', userId)
      .select('preferences')
      .single();

    if (error || !user) {
      throw new AppError('Failed to update preferences', 500);
    }

    return user.preferences || {};
  }

  /**
   * Verify Supabase access token and get user
   */
  async verifyToken(accessToken: string): Promise<{
    userId: string;
    email: string;
    role: string;
    departmentId: string | null;
  } | null> {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return null;
    }

    // Get user profile from public.users
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, role, department_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return null;
    }

    return {
      userId: profile.id,
      email: profile.email,
      role: profile.role,
      departmentId: profile.department_id,
    };
  }

  /**
   * Get all users (Admin only) - US 5.4
   */
  async getAllUsers(options: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    departmentId?: string;
  } = {}): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      departmentId: string | null;
      departmentName: string | null;
      reputationScore: number;
      creditsBalance: number;
      isActive: boolean;
      ghostCount: number;
      createdAt: string;
    }>;
    total: number;
  }> {
    const { page = 1, limit = 20, role, search, departmentId } = options;
    const skip = (page - 1) * limit;

    console.log('=== GET ALL USERS - Applying filters ===');
    console.log({ role, search, departmentId, page, limit });

    // Build query with filters
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });

    // SECURITY FIX: Apply role filter
    if (role) {
      query = query.eq('role', role);
    }

    // SECURITY FIX: Apply search filter (email, first_name, last_name)
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    // SECURITY FIX: Apply department filter
    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    // Apply pagination
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    console.log('Supabase result:', { data: data?.length, count, error });

    if (error) {
      console.error('Supabase error:', error);
      logger.error({ error }, 'Failed to fetch users');
      return { users: [], total: 0 };
    }

    if (!data || data.length === 0) {
      console.log('No users found matching filters');
      return { users: [], total: 0 };
    }

    return {
      users: data.map((u: any) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role,
        departmentId: u.department_id,
        departmentName: null, // Could join departments table if needed
        reputationScore: u.reputation_score || 100,
        creditsBalance: u.credits_balance || 0,
        isActive: u.is_active,
        ghostCount: u.ghost_count || 0,
        createdAt: u.created_at,
      })),
      total: count || 0,
    };
  }

  /**
   * Update user role (Admin only) - US 5.4
   */
  async updateUserRole(userId: string, newRole: string, adminUserId: string): Promise<void> {
    const validRoles = ['STUDENT', 'FACULTY', 'LAB_ADMIN', 'ADMIN'];
    if (!validRoles.includes(newRole)) {
      throw new AppError(`Invalid role: ${newRole}`, 400);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();

    if (error || !user) {
      throw new AppError('Failed to update user role', 500);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: userId,
      performed_by_id: adminUserId,
      metadata: { action: 'role_change', new_role: newRole },
    });

    logger.info({ userId, newRole, adminUserId }, 'User role updated');
  }
}

// Export singleton instance
export const authService = new AuthService();