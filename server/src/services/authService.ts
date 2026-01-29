/**
 * =============================================================================
 * Campus Resource Engine - Auth Service
 * =============================================================================
 * Authentication and authorization logic using Supabase
 * Table: users (snake_case columns)
 * =============================================================================
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

// User interface matching snake_case columns
interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  quota_limit_hours: number;
  reputation_score: number;
  credits_balance: number;
  is_active: boolean;
  department_id: string | null;
  no_show_count: number;
  blocked_until: string | null;
  created_at: string;
  updated_at: string;
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
 * Auth Service
 */
export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterUserInput): Promise<AuthResult> {
    logger.info({ email: input.email }, 'Registering new user');

    // Check if email exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', input.email)
      .single();

    if (existing) {
      throw new EmailAlreadyExistsError(input.email);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    // Get department
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

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.firstName,
        last_name: input.lastName,
        role: 'STUDENT',
        department_id: departmentId,
      })
      .select()
      .single();

    if (error || !user) {
      logger.error({ error }, 'Failed to create user');
      throw new AppError('Failed to create user', 500);
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

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
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const { email, password } = input;
    logger.info({ email }, 'User login attempt');

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new InvalidCredentialsError();
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

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new InvalidCredentialsError();
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Generate tokens
    const tokens = this.generateTokens(user);

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
      tokens,
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
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      throw new AppError('Current password is incorrect', 400);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId);

    logger.info({ userId }, 'Password changed');
  }

  /**
   * Generate tokens
   */
  private generateTokens(user: User): { accessToken: string; refreshToken?: string } {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as string,
    } as jwt.SignOptions);

    let refreshToken: string | undefined;
    if (config.jwt.refreshSecret) {
      refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn as string,
      } as jwt.SignOptions);
    }

    return { accessToken, refreshToken };
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
}

export const authService = new AuthService();
