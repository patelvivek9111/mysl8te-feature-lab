import { createApp } from './app';
import { seedDemo } from './seed';
import { startWorker } from './worker';

const port = Number(process.env.PORT || 3001);

async function main(): Promise<void> {
  if (process.env.SEED_ON_BOOT === 'true') {
    await seedDemo();
  }
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({ level: 'info', message: 'academic review lab listening', port }));
  });
  startWorker();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
