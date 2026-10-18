import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let counter = 0;
let notes: string[] = [];

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() 
  });
});

app.get('/api/counter', (req: Request, res: Response) => {
  res.json({ counter });
});

app.post('/api/counter/increment', (req: Request, res: Response) => {
  counter++;
  res.json({ counter, message: 'Counter incremented' });
});

app.post('/api/counter/reset', (req: Request, res: Response) => {
  counter = 0;
  res.json({ counter, message: 'Counter reset' });
});

app.get('/api/notes', (req: Request, res: Response) => {
  res.json({ notes });
});

app.post('/api/notes', (req: Request, res: Response) => {
  const { note } = req.body;
  if (!note) {
    return res.status(400).json({ error: 'Note content is required' });
  }
  notes.push(note);
  res.json({ notes, message: 'Note added' });
});

app.delete('/api/notes', (req: Request, res: Response) => {
  notes = [];
  res.json({ notes, message: 'All notes cleared' });
});

app.post('/api/test/reset', (req: Request, res: Response) => {
  // Restrict to test/development environments only
  const isTestEnv = process.env.NODE_ENV === 'test' || 
                    process.env.NODE_ENV === 'development' || 
                    process.env.ALLOW_TEST_RESET === 'true';
  
  if (!isTestEnv) {
    return res.status(403).json({ 
      error: 'Test reset endpoint is disabled in production',
      env: process.env.NODE_ENV || 'undefined'
    });
  }
  
  counter = 0;
  notes = [];
  res.json({ counter, notes, message: 'Test state reset' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
