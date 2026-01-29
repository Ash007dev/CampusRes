/**
 * =============================================================================
 * Campus Resource Engine - Authentication Middleware
 * =============================================================================
 * JWT-based authentication with Role-Based Access Control (RBAC)
 * Now using Supabase client instead of Prisma
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { UnauthorizedError, ForbiddenError, TokenExpiredError } from '../utils/errors.js';
import { supabase } from '../lib/supabase.js';
import { USER_ROLES } from '../config/constants.js';

/**
 * User roles type
 */
type UserRole = 'STUDENT' | 'FACULTY' | 'LAB_ADMIN' | 'ADMIN';

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  departmentId: string;
  iat?: number;
  exp?: number;
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
 * Authentication middleware
 * Validates JWT token and injects user into request
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    // Verify and decode token
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Inject user into request
    (req as AuthenticatedRequest).user = decoded;

    logger.debug({ userId: decoded.userId, role: decoded.role }, 'User authenticated');

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new TokenExpiredError());
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid authentication token'));
    } else {
      next(error);
    }
  }
}

/**
 * Optional authentication middleware
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    (req as AuthenticatedRequest).user = decoded;
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

/**
 * Generate JWT tokens for a user
 */
export function generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  } as jwt.SignOptions);

  const refreshToken = config.jwt.refreshSecret
    ? jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as string,
    } as jwt.SignOptions)
    : null;

  return { accessToken, refreshToken };
}
