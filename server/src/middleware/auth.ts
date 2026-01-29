/**
 * =============================================================================
 * Campus Resource Engine - Authentication Middleware
 * =============================================================================
 * Supabase Auth based authentication with Role-Based Access Control (RBAC)
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { USER_ROLES } from '../config/constants.js';

/**
 * User roles type
 */
type UserRole = 'STUDENT' | 'FACULTY' | 'LAB_ADMIN' | 'ADMIN';

/**
 * JWT Payload structure (compatible with Supabase tokens)
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
}

/**
 * Extended Request interface with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Role hierarchy for permission checking
 * Higher index = more permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  STUDENT: 0,
  FACULTY: 1,
  LAB_ADMIN: 2,
  ADMIN: 3,
};

/**
 * Extract JWT token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Authentication middleware using Supabase Auth
 * Validates Supabase JWT token and injects user into request
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    // Verify token with Supabase
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      logger.debug({ error: authError }, 'Supabase auth verification failed');
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    // Get user profile from public.users
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, department_id, is_active')
      .eq('id', authUser.id)
      .single();

    if (profileError || !userProfile) {
      logger.error({ userId: authUser.id }, 'User profile not found in public.users');
      throw new UnauthorizedError('User profile not found');
    }

    if (!userProfile.is_active) {
      throw new ForbiddenError('Your account has been deactivated');
    }

    // Inject user into request
    (req as AuthenticatedRequest).user = {
      userId: userProfile.id,
      email: userProfile.email,
      role: userProfile.role as UserRole,
      departmentId: userProfile.department_id,
    };

    logger.debug({ userId: userProfile.id, role: userProfile.role }, 'User authenticated via Supabase');

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
    } else {
      logger.error({ error }, 'Authentication error');
      next(new UnauthorizedError('Authentication failed'));
    }
  }
}

/**
 * Optional authentication middleware
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser(token);

    if (authUser) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, email, role, department_id')
        .eq('id', authUser.id)
        .single();

      if (userProfile) {
        (req as AuthenticatedRequest).user = {
          userId: userProfile.id,
          email: userProfile.email,
          role: userProfile.role as UserRole,
          departmentId: userProfile.department_id,
        };
      }
    }
  } catch {
    logger.debug('Invalid token in optional auth, proceeding without user');
  }

  next();
}

/**
 * Role-based authorization middleware
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userRole = authReq.user.role;

    if (allowedRoles.includes(userRole)) {
      next();
      return;
    }

    logger.warn({
      userId: authReq.user.userId,
      userRole,
      requiredRoles: allowedRoles,
    }, 'Authorization failed: insufficient role');

    next(new ForbiddenError(
      `Access denied. Required roles: ${allowedRoles.join(', ')}`
    ));
  };
}

/**
 * Minimum role authorization
 */
export function authorizeMinRole(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userRoleLevel = ROLE_HIERARCHY[authReq.user.role];
    const requiredLevel = ROLE_HIERARCHY[minimumRole];

    if (userRoleLevel >= requiredLevel) {
      next();
      return;
    }

    next(new ForbiddenError(
      `Access denied. Minimum role required: ${minimumRole}`
    ));
  };
}

/**
 * Self-or-admin authorization
 */
export function authorizeOwnerOrAdmin(
  getUserIdFromRequest: (req: Request) => string
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const targetUserId = getUserIdFromRequest(req);
    const isOwner = authReq.user.userId === targetUserId;
    const isAdmin = authReq.user.role === USER_ROLES.ADMIN;

    if (isOwner || isAdmin) {
      next();
      return;
    }

    next(new ForbiddenError('You can only access your own resources'));
  };
}

/**
 * Verify user still exists and is active in database
 * Note: This is now handled in the authenticate middleware itself
 */
export async function verifyActiveUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  // Already verified in authenticate middleware, but double-check if needed
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, is_active, role')
      .eq('id', authReq.user.userId)
      .single();

    if (error || !user) {
      next(new UnauthorizedError('User no longer exists'));
      return;
    }

    if (!user.is_active) {
      next(new ForbiddenError('Your account has been deactivated'));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
