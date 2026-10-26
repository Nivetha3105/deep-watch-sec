import { redisPublisher, redisSubscriber, isRedisConnected } from '../config/redis';
import { IAlert } from '../models/Alert';
import detectionEngine from '../detection/detectionEngine';

export const ALERT_CHANNEL = 'security:alerts';

type AlertListener = (alert: IAlert) => void;
const localListeners: AlertListener[] = [];

/**
 * Publishes an alert to the Redis Pub/Sub channel.
 * If Redis is not connected, dispatches directly to local listeners (graceful fallback).
 */
export async function publishAlert(alert: IAlert): Promise<void> {
  const payload = JSON.stringify(alert);

  if (isRedisConnected && redisPublisher) {
    try {
      await redisPublisher.publish(ALERT_CHANNEL, payload);
      return;
    } catch (err) {
      console.error('[PubSub] Failed to publish alert to Redis:', err);
    }
  }

  // Local fallback dispatch
  for (const listener of localListeners) {
    try {
      listener(alert);
    } catch (listenerErr) {
      console.error('[PubSub] Local listener error:', listenerErr);
    }
  }
}

/**
 * Subscribes a listener function to incoming alerts from Redis Pub/Sub.
 */
export async function subscribeToAlerts(listener: AlertListener): Promise<void> {
  localListeners.push(listener);

  if (isRedisConnected && redisSubscriber) {
    try {
      await redisSubscriber.subscribe(ALERT_CHANNEL, (message) => {
        try {
          const alert = JSON.parse(message) as IAlert;
          listener(alert);
        } catch (parseErr) {
          console.error('[PubSub] Error parsing incoming alert message:', parseErr);
        }
      });
      console.log(`[PubSub] Subscribed to Redis channel: ${ALERT_CHANNEL}`);
    } catch (subErr) {
      console.error('[PubSub] Failed to subscribe to Redis channel:', subErr);
    }
  }
}

// Hook DetectionEngine output automatically to PubSub
detectionEngine.onAlertGenerated(async (alert) => {
  await publishAlert(alert);
});
