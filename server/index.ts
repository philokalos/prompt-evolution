import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { initializeScheduler } from './services/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// CORS - restrict to known local origins
const isProd = process.env.NODE_ENV === 'production';
app.use(cors({
  origin: isProd ? false : ['http://localhost:5173', 'http://localhost:5174', `http://localhost:${PORT}`],
  methods: ['GET', 'POST'],
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Sync rate limit exceeded. Try again in a minute.' },
});
app.use('/api/sync', syncLimiter);

app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api', apiRouter);

// Serve static files in production
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
