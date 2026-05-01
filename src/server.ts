import { app } from './app';
import { env } from './config/env';



const bootstrap = async () => {
  

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${env.PORT}`);
  });
};

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  // eslint-disable-next-line no-console
  console.error(`Startup failed: ${message}`);
  process.exit(1);
});
