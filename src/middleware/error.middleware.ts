import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../lib/logger';

export const notFoundHandler = (_req: Request, res: Response) => {
  return res.status(404).json({ error: 'not_found', message: 'Route not found' });
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    logger.warn('app_error', {
      event: 'app_error',
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: err.statusCode,
      error_code: err.code,
      message: err.message,
      details: err.details,
      user_id: req.user?.id,
    });

    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error('unhandled_error', {
    event: 'unhandled_error',
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status: 500,
    error: message,
    stack: err instanceof Error ? err.stack : undefined,
    user_id: req.user?.id,
  });

  return res.status(500).json({ error: 'internal_server_error', message });
};
