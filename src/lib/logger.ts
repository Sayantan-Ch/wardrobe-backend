import winston from 'winston';
import { env } from '../config/env';
import { getRequestContext } from './request-context';

const attachRequestContext = winston.format((info) => {
  const context = getRequestContext();

  if (!context) {
    return info;
  }

  info.request_id ??= context.requestId;

  if (context.userId) {
    info.user_id ??= context.userId;
  }

  if (context.userRole) {
    info.user_role ??= context.userRole;
  }

  return info;
});

const redactSensitive = winston.format((info) => {
  delete info.authorization;
  delete info.token;
  delete info.apiKey;
  delete info.serviceRoleKey;
  delete info.fileBuffer;
  delete info.dataUrl;

  return info;
});

const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  attachRequestContext(),
  redactSensitive(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metadata = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const errorStack = typeof stack === 'string' ? `\n${stack}` : '';
    return `${timestamp} ${level}: ${message}${metadata}${errorStack}`;
  }),
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  attachRequestContext(),
  redactSensitive(),
  winston.format.json(),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  attachRequestContext(),
  redactSensitive(),
  winston.format.json(),
);

const fileTransports = env.LOG_TO_FILE
  ? [
      new winston.transports.File({
        filename: `${env.LOG_DIR}/combined.log`,
        format: fileFormat,
      }),
      new winston.transports.File({
        filename: `${env.LOG_DIR}/error.log`,
        level: 'error',
        format: fileFormat,
      }),
    ]
  : [];

const transports = [
  new winston.transports.Console(),
  ...fileTransports,
];

export const logger = winston.createLogger({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports,
});

export type LogMetadata = Record<string, unknown>;
