import mongoose from 'mongoose';
import { IDetectionRule, DetectionResult } from '../types';
import Event, { IEvent } from '../../models/Event';
import Alert from '../../models/Alert';
import { inMemoryStore } from '../../services/inMemoryStore';

export class RequestBurstRule implements IDetectionRule {
  public name = 'REQUEST_BURST_RULE';
  public description = 'Detects excessive request velocity (>= 20 requests in 10s) indicating DoS or high-rate flooding.';

  private readonly TIME_WINDOW_MS = 10 * 1000; // 10 seconds
  private readonly THRESHOLD = 20;
  private readonly COOLDOWN_MS = 20 * 1000; // 20s cooldown

  async evaluate(event: IEvent): Promise<DetectionResult | null> {
    const windowStart = new Date(Date.now() - this.TIME_WINDOW_MS);
    const cooldownStart = new Date(Date.now() - this.COOLDOWN_MS);

    let recentAlert: any = null;
    let recentEvents: any[] = [];

    if (mongoose.connection.readyState === 1) {
      recentAlert = await Alert.findOne({
        source_ip: event.source_ip,
        attack_type: 'REQUEST_BURST',
        detected_at: { $gte: cooldownStart },
      }).lean();

      if (recentAlert) return null;

      recentEvents = await Event.find({
        source_ip: event.source_ip,
        timestamp: { $gte: windowStart },
      })
        .select('_id')
        .lean();
    } else {
      recentAlert = inMemoryStore.findRecentAlert(event.source_ip, 'REQUEST_BURST', cooldownStart);
      if (recentAlert) return null;

      recentEvents = inMemoryStore.findEvents({
        source_ip: event.source_ip,
        timestampGte: windowStart,
      });
    }

    if (recentEvents.length >= this.THRESHOLD) {
      return {
        triggered: true,
        rule_name: this.name,
        attack_type: 'REQUEST_BURST',
        severity: 'HIGH',
        source_ip: event.source_ip,
        message: `Detected suspicious request burst (${recentEvents.length} requests in ${this.TIME_WINDOW_MS / 1000}s) from IP ${event.source_ip}.`,
        related_event_ids: recentEvents.map((e) => (e._id ? e._id : e)),
        metadata: {
          request_count: recentEvents.length,
          threshold: this.THRESHOLD,
          window_seconds: this.TIME_WINDOW_MS / 1000,
        },
      };
    }

    return null;
  }
}

export const requestBurstRule = new RequestBurstRule();
