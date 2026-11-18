import { createApp } from './app';
import { seedDemo } from './seed';
import { startWorker } from './worker';
import { backfillExcludedOffsets, refreshStaleAnalyses } from './services/aiAssessment';

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
  const refreshed = await refreshStaleAnalyses();
  if (refreshed > 0) console.log(JSON.stringify({ level: 'info', message: 'rebuilt analyses from an older model version', count: refreshed }));
  const backfilled = await backfillExcludedOffsets();
  if (backfilled > 0) console.log(JSON.stringify({ level: 'info', message: 'rebuilt similarity reports to store excluded-region offsets', count: backfilled }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
