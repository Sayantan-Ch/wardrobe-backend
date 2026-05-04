import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { runWithRequestContext } from '../lib/request-context';

const getPath = (req: Request) => req.originalUrl.split('?')[0] ?? req.originalUrl;

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const startedAt = process.hrtime.bigint();

  runWithRequestContext({ requestId: req.requestId }, () => {
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const statusCode = res.statusCode;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      logger.log(level, 'http_request_completed', {
        event: 'http_request_completed',
        request_id: req.requestId,
        method: req.method,
        path: getPath(req),
        status: statusCode,
        duration_ms: Math.round(durationMs),
        user_id: req.user?.id,
      });
    });

    next();
  });
};
