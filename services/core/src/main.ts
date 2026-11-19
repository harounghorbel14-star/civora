import { createApp } from './app.factory';
import { APP_CONFIG, type AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const cfg = app.get<AppConfig>(APP_CONFIG);
  await app.listen(cfg.port, '0.0.0.0');
}

bootstrap().catch((err: unknown) => {
  process.stderr.write(JSON.stringify({ level: 'fatal', service: 'civora-core', msg: err instanceof Error ? err.message : String(err) }) + '\n');
  process.exit(1);
});
