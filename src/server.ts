import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import routes from './routes';
import { authenticate, requireAdmin } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Security Headers
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS configuration allowing cookies and headers from trusted frontend clients
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server, curl)
      if (!origin) return callback(null, true);

      if (process.env.NODE_ENV === 'production') {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy: Origin unauthorized'));
      } else {
        if (
          origin.startsWith('http://localhost') ||
          origin.startsWith('http://127.0.0.1') ||
          allowedOrigins.includes(origin)
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global session authentication middleware
app.use('/api', authenticate);

// Mount main API routes
app.use('/api', routes);

// System Health Check
const healthHandler = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'TechWave Retail360 API',
    business: 'Royal Saree & Fashion',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Secure Diagnostic Endpoint (Admin only in development or authenticated)
app.get('/test-gemini', authenticate, async (req: any, res) => {
  if (process.env.NODE_ENV === 'production' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  try {
    const isBearer = apiKey?.startsWith('ya29.');
    const url = isBearer
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isBearer) headers['Authorization'] = `Bearer ${apiKey}`;
    else headers['x-goog-api-key'] = apiKey || '';

    const googleRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello, what day is today?' }] }],
      }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await googleRes.json();
    res.json({
      status: googleRes.status,
      ok: googleRes.ok,
      hasKey: !!apiKey,
      data,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[UNCAUGHT API ERROR]:', err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'An unexpected error occurred. Please contact store support.'
      : err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 TechWave Retail360 API Server running on port ${PORT}`);
  console.log(`🔗 Endpoint Base: http://localhost:${PORT}/api`);
  console.log(`✨ Demo Business: Royal Saree & Fashion`);
  console.log(`👤 Admin: admin@royal.techwavesolutions.dev`);
  console.log(`🛍️ Customer: priya.sharma@example.com`);
  console.log('====================================================');
});

export default app;
