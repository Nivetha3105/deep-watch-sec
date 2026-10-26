import mongoose from 'mongoose';
import { IDetectionRule, DetectionResult } from '../types';
import Event, { IEvent } from '../../models/Event';
import Alert from '../../models/Alert';
import { inMemoryStore } from '../../services/inMemoryStore';

export class BruteForceRule implements IDetectionRule {
  public name = 'BRUTE_FORCE_RULE';
  public description = 'Detects 5 or more failed login attempts from a single IP within 60 seconds.';

  private readonly TIME_WINDOW_MS = 60 * 1000; // 60 seconds
  private readonly THRESHOLD = 5;
  private readonly COOLDOWN_MS = 30 * 1000; // 30s alert deduplication cooldown

  async evaluate(event: IEvent): Promise<DetectionResult | null> {
    const action = (event.action || '').toUpperCase();
    const result = (event.result || '').toUpperCase();
    if (action !== 'LOGIN' || result !== 'FAILED') {
      return null;
    }

    const windowStart = new Date(Date.now() - this.TIME_WINDOW_MS);
    const cooldownStart = new Date(Date.now() - this.COOLDOWN_MS);

    let recentAlert: any = null;
    let failedLogins: any[] = [];

    if (mongoose.connection.readyState === 1) {
      recentAlert = await Alert.findOne({
        source_ip: event.source_ip,
        attack_type: { $in: ['BRUTE_FORCE', 'BRUTE FORCE'] },
        detected_at: { $gte: cooldownStart },
      }).lean();

      if (recentAlert) return null;

      failedLogins = await Event.find({
        source_ip: event.source_ip,
        action: 'LOGIN',
        result: 'FAILED',
        timestamp: { $gte: windowStart },
      })
        .select('_id timestamp')
        .lean();
    } else {
      recentAlert =
        inMemoryStore.findRecentAlert(event.source_ip, 'BRUTE_FORCE', cooldownStart) ||
        inMemoryStore.findRecentAlert(event.source_ip, 'BRUTE FORCE', cooldownStart);
      if (recentAlert) return null;

      failedLogins = inMemoryStore.findEvents({
        source_ip: event.source_ip,
        action: 'LOGIN',
        result: 'FAILED',
        timestampGte: windowStart,
      });
    }

    if (failedLogins.length >= this.THRESHOLD) {
      return {
        triggered: true,
        rule_name: this.name,
        attack_type: 'BRUTE_FORCE',
        severity: 'HIGH',
        source_ip: event.source_ip,
        message: `Detected ${failedLogins.length} failed login attempts from IP ${event.source_ip} within ${this.TIME_WINDOW_MS / 1000}s rolling window.`,
        related_event_ids: failedLogins.map((e) => (e._id ? e._id : e)),
        metadata: {
          failed_count: failedLogins.length,
          threshold: this.THRESHOLD,
          window_seconds: this.TIME_WINDOW_MS / 1000,
        },
      };
    }

    return null;
  }
}

export const bruteForceRule = new BruteForceRule();
