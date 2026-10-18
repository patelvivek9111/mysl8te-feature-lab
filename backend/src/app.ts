import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { DB } from './db/database';
import { resetDatabase } from './db/database';
import { authenticate, resetRateLimits } from './auth/auth';
import { HttpError } from './http';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import integrityRoutes from './routes/integrity';
import { createSubmissionRouter } from './routes/submissions';
import { seedDemo } from './seed';

export interface AppConfig {
  db: DB;
  uploadDir: string;
  maxFileSize?: number;
  frontendOrigin?: string;
  allowTestReset?: boolean;
}

export function createApp(config: AppConfig) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(cors({ origin: config.frontendOrigin ?? 'http://localhost:5173', credentials: true }));
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.json({ limit: '3mb' }));
  app.use((req, _res, next) => {
    req.db = config.db;
    next();
  });
  app.use(authenticate);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', courseRoutes);
  app.use('/api', createSubmissionRouter({ uploadDir: config.uploadDir, maxFileSize: config.maxFileSize ?? 25 * 1024 * 1024 }));
  app.use('/api', integrityRoutes);

  app.post('/api/test/reset', async (req, res, next) => {
    if (process.env.NODE_ENV === 'production' || !config.allowTestReset) {
      return res.status(403).json({ error: 'Test reset endpoint is disabled' });
    }
    const remote = req.socket.remoteAddress ?? '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) || req.headers['x-requested-with'] !== 'mysl8te') {
      return res.status(403).json({ error: 'Test reset requires a local request with the X-Requested-With: mysl8te header' });
    }
    try {
      resetDatabase(config.db);
      resetRateLimits();
      const seeded = req.query.seed === 'demo' ? await seedDemo(config.db, config.uploadDir) : null;
      res.json({ ok: true, seeded });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if ((err as { type?: string }).type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
    if ((err as { type?: string }).type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
