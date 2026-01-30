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
import {
  InvalidCredentialsError,
  UserNotFoundError,
  EmailAlreadyExistsError,
  AppError,
} from '../utils/errors.js';

// Registration input interface
interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentCode?: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    departmentId: string | null;
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
    if (input.departmentCode) {
      const { data: dept } = await supabase
        .from('departments')
        .select('id')
        .eq('code', input.departmentCode)
        .single();

      if (dept) {
        departmentId = dept.id;
      }
    }

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // Auto-confirm email for now
      user_metadata: {
        first_name: input.firstName,
        last_name: input.lastName,
      },
    });

    if (authError) {
      logger.error({ error: authError }, 'Failed to create auth user');
      if (authError.message.includes('already registered')) {
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
        role: 'STUDENT',
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

    // Sign in to get tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (signInError || !signInData.session) {
      logger.error({ error: signInError }, 'Failed to sign in after registration');
      throw new AppError('Registration successful but login failed', 500);
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
      },
      tokens: {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
      },
    };
  }

  /**
   * Login user using Supabase Auth
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
      logger.warn({ email, error: signInError }, 'Login failed');
      throw new InvalidCredentialsError();
    }

    // Get user profile from public.users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (userError || !user) {
      logger.error({ userId: signInData.user.id }, 'User profile not found in public.users');
      throw new AppError('User profile not found', 500);
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

    return {
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
      departmentId: data.department_id,
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
}

export const authService = new AuthService();
