import dns from 'dns';
import http from 'http';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from './config/db';
import { initRedis, disconnectRedis } from './config/redis';
import { initSocketIO } from './services/socketService';
import healthRoutes from './routes/healthRoutes';
import eventRoutes from './routes/eventRoutes';
import alertRoutes from './routes/alertRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import auditRoutes from './routes/auditRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { notificationWorker } from './services/notificationWorker';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app: Application = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSockets
initSocketIO(server);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware for transparency and debugging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount Routes
app.use('/api/health', healthRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

/**
 * Start the HTTP server after connecting to MongoDB and Redis.
 */
async function startServer(): Promise<void> {
  // Connect to persistent store
  await connectDB();

  // Connect to Redis for caching & pub/sub (with graceful fallback if offline)
  await initRedis();

  // Initialize notification worker listener
  await notificationWorker.start();

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Network Intrusion Backend running on port ${PORT}`);
    console.log(`📡 Health Check:    http://localhost:${PORT}/api/health`);
    console.log(`📥 Event Ingest:    http://localhost:${PORT}/api/events`);
    console.log(`🚨 Alerts Feed:     http://localhost:${PORT}/api/alerts`);
    console.log(`📊 Analytics:       http://localhost:${PORT}/api/analytics/summary`);
    console.log(`📜 Audit Logs:      http://localhost:${PORT}/api/audit-logs`);
    console.log(`🔔 Notifications:   http://localhost:${PORT}/api/notifications/status`);
    console.log(`🔌 WebSocket:       ws://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down server...');
  notificationWorker.stop();
  await disconnectRedis();
  await disconnectDB();
  process.exit(0);
});

// Start the server only if run directly and not under a test runner
const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('--test') || arg.includes('test'));

if (!isTestEnv) {
  startServer();
}

export { app, server };
export default app;
