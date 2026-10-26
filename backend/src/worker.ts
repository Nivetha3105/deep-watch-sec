import dotenv from 'dotenv';
import { connectDB, disconnectDB } from './config/db';
import { initRedis, disconnectRedis } from './config/redis';
import { notificationWorker } from './services/notificationWorker';

dotenv.config();

/**
 * Standalone Notification Worker Process
 * Can be run via: `npm --prefix backend run worker`
 * Or as a dedicated container in Docker Compose.
 */
async function startWorker(): Promise<void> {
  console.log('=======================================================');
  console.log('👷 SentinelIDS Notification Worker starting up...');
  console.log('=======================================================');

  // Connect to persistent store (for audit logging)
  await connectDB();

  // Connect to Redis pub/sub
  await initRedis();

  // Launch worker subscription loop
  await notificationWorker.start();

  console.log('✅ Notification Worker is actively listening for security alerts.');
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n[NotificationWorker] Gracefully shutting down worker...');
  notificationWorker.stop();
  await disconnectRedis();
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[NotificationWorker] Received SIGTERM, shutting down...');
  notificationWorker.stop();
  await disconnectRedis();
  await disconnectDB();
  process.exit(0);
});

if (process.env.NODE_ENV !== 'test') {
  startWorker().catch((err) => {
    console.error('Fatal error starting notification worker:', err);
    process.exit(1);
  });
}

export { startWorker };
