import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';

export const notFoundHandler = (_req: Request, res: Response) => {
  return res.status(404).json({ error: 'not_found', message: 'Route not found' });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return res.status(500).json({ error: 'internal_server_error', message });
};
