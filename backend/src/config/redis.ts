import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export let redisClient: RedisClientType | null = null;
export let redisPublisher: RedisClientType | null = null;
export let redisSubscriber: RedisClientType | null = null;
export let isRedisConnected = false;

/**
 * Initialize Redis clients for Caching and Pub/Sub.
 * Uses separate dedicated connections for Publisher, Subscriber, and General Caching
 * as required by Redis Pub/Sub architecture, with an instant in-memory fallback.
 */
export async function initRedis(): Promise<void> {
  const clientOptions = {
    url: REDIS_URL,
    socket: {
      connectTimeout: 1500,
      reconnectStrategy: false as const, // Do not endlessly retry if Redis is offline
    },
  };

  try {
    redisClient = createClient(clientOptions);
    redisPublisher = createClient(clientOptions);
    redisSubscriber = createClient(clientOptions);

    // Suppress unhandled error crashes
    redisClient.on('error', () => {});
    redisPublisher.on('error', () => {});
    redisSubscriber.on('error', () => {});

    await Promise.all([
      redisClient.connect(),
      redisPublisher.connect(),
      redisSubscriber.connect(),
    ]);

    isRedisConnected = true;
    console.log(`✅ Redis connected successfully to: ${REDIS_URL}`);
  } catch (error: any) {
    isRedisConnected = false;
    // Disconnect clients to prevent stray reconnect attempts
    await Promise.allSettled([
      redisClient?.disconnect(),
      redisPublisher?.disconnect(),
      redisSubscriber?.disconnect(),
    ]);
    console.warn(`⚠️ Redis is offline at ${REDIS_URL}. Running in in-memory pub/sub & cache fallback mode.`);
  }
}

/**
 * Disconnect Redis clients cleanly on server shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (isRedisConnected) {
    await Promise.allSettled([
      redisClient?.disconnect(),
      redisPublisher?.disconnect(),
      redisSubscriber?.disconnect(),
    ]);
    console.log('[Redis] Disconnected cleanly.');
  }
}
