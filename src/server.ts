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

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 TechWave Retail360 API Server running on port ${PORT}`);
  console.log(`🔗 Endpoint Base: http://localhost:${PORT}/api`);
  console.log(`✨ Demo Business: Royal Saree & Fashion`);
  console.log(`👤 Admin: admin@royal.techwavesolutions.dev (pw: admin123)`);
  console.log(`🛍️ Customer: priya.sharma@example.com (pw: customer123)`);
  console.log('====================================================');
});

export default app;
