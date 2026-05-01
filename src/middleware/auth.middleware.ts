import type { NextFunction, Request, Response } from 'express';
import { supabaseAnonClient } from '../config/supabase';

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
    return unauthorized(res, 'Missing or invalid Authorization header');
  }

  const { data, error } = await supabaseAnonClient.auth.getUser(token);

  if (error || !data.user) {
    return unauthorized(res, 'Invalid or expired token');
  }

  req.user = data.user;
  req.userRole =
    typeof data.user.app_metadata?.role === 'string'
      ? data.user.app_metadata.role
      : typeof data.user.user_metadata?.role === 'string'
        ? data.user.user_metadata.role
        : 'user';

  return next();
};

export const requireRole = (allowedRoles: string[]) => {
  const roleSet = new Set(allowedRoles);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return unauthorized(res, 'Authentication is required');
    }

    if (!req.userRole || !roleSet.has(req.userRole)) {
      return forbidden(res, 'Insufficient role permissions');
    }

    return next();
  };
};
