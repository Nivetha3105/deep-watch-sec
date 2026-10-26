import { IAlert } from '../models/Alert';
import { subscribeToAlerts } from './pubsubService';
import { notificationDispatcher } from './notifications/notificationDispatcher';

/**
 * NotificationWorker
 * 
 * Standalone worker that subscribes to the Redis Pub/Sub channel 'security:alerts'
 * (with local fallback), safely validates and filters alerts, and dispatches them
 * to active notification providers (Discord, Telegram, Email).
 * Decoupled from event ingestion so third-party provider latency never blocks the API.
 */
export class NotificationWorker {
  private isRunning = false;

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[NotificationWorker] Worker already running.');
      return;
    }
    this.isRunning = true;
    console.log('👷 [NotificationWorker] Initializing notification worker...');

    await subscribeToAlerts(async (alert: IAlert) => {
      try {
        await this.handleAlert(alert);
      } catch (err) {
        console.error('[NotificationWorker] Error processing alert message:', err);
      }
    });

    console.log('👷 [NotificationWorker] Successfully subscribed to alert pipeline.');
  }

  /**
   * Validate and dispatch an incoming threat alert.
   */
  public async handleAlert(alert: any): Promise<{ skipped?: boolean; reason?: string }> {
    if (!alert || typeof alert !== 'object') {
      console.warn('[NotificationWorker] Discarding invalid alert payload');
      return { skipped: true, reason: 'Invalid alert payload' };
    }

    const outcome = await notificationDispatcher.dispatchAlert(alert);
    if (outcome.skipped) {
      console.log(`[NotificationWorker] Notification skipped: ${outcome.reason}`);
    } else {
      const summary = outcome.results
        .map((r) => `${r.provider}:${r.success ? 'OK' : 'FAILED'}`)
        .join(', ');
      console.log(`[NotificationWorker] Dispatched alert [${alert.attack_type}] (${summary})`);
    }

    return outcome;
  }

  public stop(): void {
    this.isRunning = false;
    console.log('👷 [NotificationWorker] Worker stopped.');
  }
}

export const notificationWorker = new NotificationWorker();
