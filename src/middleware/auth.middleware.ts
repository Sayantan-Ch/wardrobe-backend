import type { NextFunction, Request, Response } from 'express';
import { supabaseAnonClient } from '../config/supabase';
import { logger } from '../lib/logger';
import { updateRequestContext } from '../lib/request-context';

const unauthorized = (res: Response, message: string) => {
  return res.status(401).json({ error: 'unauthorized', message });
};

const forbidden = (res: Response, message: string) => {
  return res.status(403).json({ error: 'forbidden', message });
};

const extractBearerToken = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    logger.warn('auth_failed', {
      event: 'auth_failed',
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      reason: 'missing_or_invalid_authorization_header',
    });
    return unauthorized(res, 'Missing or invalid Authorization header');
  }

  const { data, error } = await supabaseAnonClient.auth.getUser(token);

  if (error || !data.user) {
    logger.warn('auth_failed', {
      event: 'auth_failed',
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      reason: 'invalid_or_expired_token',
      auth_error: error?.message,
    });
    return unauthorized(res, 'Invalid or expired token');
  }

  req.user = data.user;
  req.userRole =
    typeof data.user.app_metadata?.role === 'string'
      ? data.user.app_metadata.role
      : typeof data.user.user_metadata?.role === 'string'
        ? data.user.user_metadata.role
        : 'user';

  updateRequestContext({
    userId: req.user.id,
    userRole: req.userRole,
  });

  logger.debug('auth_succeeded', {
    event: 'auth_succeeded',
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl,
    user_id: req.user.id,
    role: req.userRole,
  });

  return next();
};

export const requireRole = (allowedRoles: string[]) => {
  const roleSet = new Set(allowedRoles);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return unauthorized(res, 'Authentication is required');
    }

    if (!req.userRole || !roleSet.has(req.userRole)) {
      logger.warn('role_denied', {
        event: 'role_denied',
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl,
        user_id: req.user.id,
        role: req.userRole,
        allowed_roles: allowedRoles,
      });
      return forbidden(res, 'Insufficient role permissions');
    }

    return next();
  };
};
