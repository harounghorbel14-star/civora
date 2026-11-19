// Tracing must be registered before NestJS, Express, http and pg are loaded, so the application is required lazily.
import { startTracing } from './tracing/tracing';

const tracing = startTracing();

async function bootstrap(): Promise<void> {
  const { createApp } = await import('./app.factory');
  const { APP_CONFIG } = await import('./config/app-config');
  const app = await createApp();
  const cfg = app.get<import('./config/app-config').AppConfig>(APP_CONFIG);
  if (tracing) {
    const stop = async (): Promise<void> => {
      await tracing.shutdown().catch(() => undefined);
    };
    process.once('SIGTERM', () => void stop());
    process.once('SIGINT', () => void stop());
  }
  await app.listen(cfg.port, '0.0.0.0');
}

bootstrap().catch((err: unknown) => {
  process.stderr.write(JSON.stringify({ level: 'fatal', service: 'civora-core', msg: err instanceof Error ? err.message : String(err) }) + '\n');
  process.exit(1);
});
