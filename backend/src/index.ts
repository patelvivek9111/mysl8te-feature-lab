import path from 'node:path';
import { createApp } from './app';
import { openDatabase } from './db/database';

const PORT = Number(process.env.PORT || 3001);
const root = path.resolve(__dirname, '..');
const dbPath = process.env.DATABASE_PATH ? path.resolve(root, process.env.DATABASE_PATH) : path.join(root, 'data', 'feature-lab.sqlite');
const uploadDir = process.env.UPLOAD_DIR ? path.resolve(root, process.env.UPLOAD_DIR) : path.join(root, 'data', 'uploads');

const isProduction = process.env.NODE_ENV === 'production';
const allowTestReset = !isProduction && (process.env.ALLOW_TEST_RESET === 'true' || process.env.NODE_ENV === 'test');

const db = openDatabase(dbPath);
const app = createApp({
  db,
  uploadDir,
  maxFileSize: Number(process.env.MAX_FILE_SIZE || 25 * 1024 * 1024),
  frontendOrigin: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowTestReset,
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
