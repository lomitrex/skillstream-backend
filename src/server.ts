import express from 'express';
import type { Application } from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Load environment variables before any service initialization
dotenv.config();

// Configs & Sockets
import { initPgDb } from './config/db';
import { connectMongo } from './config/mongo';
import { connectRedis } from './config/redis';

// Security Middlewares
import {
  securityHeaders,
  apiLimiter,
  authLimiter,
  noSqlInjectionSanitizer,
  xssSanitizer,
  sqlInjectionGuard,
} from './middleware/security.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import courseRoutes from './routes/course.routes';
import reviewRoutes from './routes/review.routes';
import uploadRoutes from './routes/upload.routes';
import webhookRoutes from './routes/webhook.routes';

// Global Error Handler
import { errorHandler } from './middleware/error.middleware';

export const app: Application = express();
export const server = createServer(app);

// 1. Security Headers (Helmet)
app.use(securityHeaders);

// 2. Cookie & Body Parsers
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 3. Input Sanitization (NoSQLi, XSS, SQLi Guards)
app.use(noSqlInjectionSanitizer);
app.use(xssSanitizer);
app.use(sqlInjectionGuard);

// 4. Rate-Limited API Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/courses', apiLimiter, courseRoutes);
app.use('/api/v1/reviews', apiLimiter, reviewRoutes);
app.use('/api/v1/uploads', apiLimiter, uploadRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// 5. Centralized Error Handler
app.use(errorHandler);

// Lifecycle Management
const PORT = process.env.PORT || 3000;

const startup = async (): Promise<void> => {
  try {
    await initPgDb();
    console.log('PostgreSQL database initialized successfully');

    await connectMongo();
    console.log('MongoDB connected successfully');

    await connectRedis();
    console.log('Redis Cache connected successfully');

    server.listen(PORT, () => {
      console.log(`SkillStream engine listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startup();
}