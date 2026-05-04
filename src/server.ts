import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';

const bootstrap = async () => {
  app.listen(env.PORT, () => {
    logger.info('server_started', {
      event: 'server_started',
      port: env.PORT,
      node_env: env.NODE_ENV,
    });
  });
};

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  logger.error('startup_failed', {
    event: 'startup_failed',
    error: message,
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
