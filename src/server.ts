import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import routes from './routes';
import { authenticate } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// CORS configuration allowing cookies and headers from frontend
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost and specified frontend clients
      if (!origin || origin.startsWith('http://localhost') || origin === CLIENT_URL) {
        callback(null, true);
      } else {
        callback(null, true);
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
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TechWave Retail360 API',
    business: 'Royal Saree & Fashion',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/test-gemini', async (req, res) => {
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
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
      data,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 TechWave Retail360 API Server running on port ${PORT}`);
  console.log(`🔗 Endpoint Base: http://localhost:${PORT}/api`);
  console.log(`✨ Demo Business: Royal Saree & Fashion`);
  console.log(`👤 Admin: admin@royal.techwavesolutions.dev (pw: admin123)`);
  console.log(`🛍️ Customer: priya.sharma@example.com (pw: customer123)`);
  console.log('====================================================');
});

// Reload trigger: Admin alerts for new registrations and new orders active!
export default app;
