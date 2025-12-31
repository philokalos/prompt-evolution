import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { initializeScheduler } from './services/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRouter);

// Serve static files in production
// In dev: __dirname = /project/server, so ../web/dist works
// In prod: __dirname = /project/dist/server, so ../../web/dist works
const webDistPath = path.join(__dirname, '../../web/dist');
app.use(express.static(webDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(webDistPath, 'index.html'), (err) => {
    if (err) {
      // In development, web/dist might not exist
      res.status(200).json({ message: 'Dashboard not built. Run npm run build:web first.' });
    }
  });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────┐
  │  Prompt Evolution Dashboard Server      │
  │                                         │
  │  API:       http://localhost:${PORT}/api   │
  │  Dashboard: http://localhost:${PORT}       │
  └─────────────────────────────────────────┘
  `);

  // Initialize scheduler after server starts
  initializeScheduler();
});
