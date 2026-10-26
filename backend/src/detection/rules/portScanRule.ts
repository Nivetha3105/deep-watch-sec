import mongoose from 'mongoose';
import { IDetectionRule, DetectionResult } from '../types';
import Event, { IEvent } from '../../models/Event';
import Alert from '../../models/Alert';
import { inMemoryStore } from '../../services/inMemoryStore';

export class PortScanRule implements IDetectionRule {
  public name = 'PORT_SCAN_RULE';
  public description = 'Detects reconnaissance port scanning or service probing across >= 8 distinct targets in 10s.';

  private readonly TIME_WINDOW_MS = 10 * 1000; // 10 seconds
  private readonly DISTINCT_TARGET_THRESHOLD = 8;
  private readonly COOLDOWN_MS = 20 * 1000; // 20s cooldown

  async evaluate(event: IEvent): Promise<DetectionResult | null> {
    const windowStart = new Date(Date.now() - this.TIME_WINDOW_MS);
    const cooldownStart = new Date(Date.now() - this.COOLDOWN_MS);

    let recentAlert: any = null;
    let recentEvents: any[] = [];

    if (mongoose.connection.readyState === 1) {
      recentAlert = await Alert.findOne({
        source_ip: event.source_ip,
        attack_type: 'PORT_SCAN',
        detected_at: { $gte: cooldownStart },
      }).lean();

      if (recentAlert) return null;

      recentEvents = await Event.find({
        source_ip: event.source_ip,
        timestamp: { $gte: windowStart },
      })
        .select('_id port action timestamp')
        .lean();
    } else {
      recentAlert = inMemoryStore.findRecentAlert(event.source_ip, 'PORT_SCAN', cooldownStart);
      if (recentAlert) return null;

      recentEvents = inMemoryStore.findEvents({
        source_ip: event.source_ip,
        timestampGte: windowStart,
      });
    }

    const distinctProbes = new Set<string>();
    recentEvents.forEach((e) => {
      if (e.port) distinctProbes.add(`port:${e.port}`);
      else if (e.action) distinctProbes.add(`action:${e.action}`);
    });

    if (distinctProbes.size >= this.DISTINCT_TARGET_THRESHOLD) {
      return {
        triggered: true,
        rule_name: this.name,
        attack_type: 'PORT_SCAN',
        severity: 'MEDIUM',
        source_ip: event.source_ip,
        message: `Detected port scanning / service reconnaissance across ${distinctProbes.size} distinct ports/endpoints from IP ${event.source_ip} within ${this.TIME_WINDOW_MS / 1000}s.`,
        related_event_ids: recentEvents.map((e) => (e._id ? e._id : e)),
        metadata: {
          distinct_count: distinctProbes.size,
          probes_sample: Array.from(distinctProbes).slice(0, 10),
          window_seconds: this.TIME_WINDOW_MS / 1000,
        },
      };
    }

    return null;
  }
}

export const portScanRule = new PortScanRule();
