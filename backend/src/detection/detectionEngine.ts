import mongoose from 'mongoose';
import { IEvent } from '../models/Event';
import Alert, { IAlert } from '../models/Alert';
import { IDetectionRule, DetectionResult } from './types';
import { bruteForceRule } from './rules/bruteForceRule';
import { portScanRule } from './rules/portScanRule';
import { requestBurstRule } from './rules/requestBurstRule';
import { inMemoryStore } from '../services/inMemoryStore';
import { logAudit } from '../services/auditService';

// Type for alert broadcast listener (used by Redis PubSub & WebSocket)
export type AlertBroadcastHandler = (alert: IAlert) => void | Promise<void>;

/**
 * DetectionEngine
 * 
 * Orchestrates rule execution for every incoming network telemetry event.
 * Follows an open-closed principle: new threat detection rules can be registered
 * dynamically without changing the event ingestion handler or existing rules.
 */
export class DetectionEngine {
  private rules: IDetectionRule[] = [];
  private broadcastHandlers: AlertBroadcastHandler[] = [];

  constructor() {
    // Register default security rules
    this.registerRule(bruteForceRule);
    this.registerRule(portScanRule);
    this.registerRule(requestBurstRule);
  }

  /**
   * Register a new detection rule
   */
  public registerRule(rule: IDetectionRule): void {
    this.rules.push(rule);
    console.log(`[DetectionEngine] Registered rule: ${rule.name}`);
  }

  /**
   * Register an alert handler (e.g. Redis publisher, WebSocket broadcast)
   */
  public onAlertGenerated(handler: AlertBroadcastHandler): void {
    this.broadcastHandlers.push(handler);
  }

  /**
   * Evaluate a newly ingested event against all registered detection rules.
   * Persists generated alerts to MongoDB or in-memory store and dispatches notifications.
   */
  public async evaluateEvent(event: IEvent): Promise<IAlert[]> {
    const generatedAlerts: IAlert[] = [];

    // Evaluate all rules concurrently
    const ruleEvaluations = this.rules.map(async (rule) => {
      try {
        return await rule.evaluate(event);
      } catch (err) {
        console.error(`[DetectionEngine] Error executing rule ${rule.name}:`, err);
        return null;
      }
    });

    const results = await Promise.all(ruleEvaluations);

    for (const result of results) {
      if (result && result.triggered) {
        try {
          let savedAlert: any;

          if (mongoose.connection.readyState === 1) {
            const alert = new Alert({
              attack_type: result.attack_type,
              severity: result.severity,
              source_ip: result.source_ip,
              message: result.message,
              related_event_ids: result.related_event_ids,
              status: 'OPEN',
              detected_at: new Date(),
            });
            savedAlert = await alert.save();
          } else {
            savedAlert = inMemoryStore.saveAlert({
              attack_type: result.attack_type,
              severity: result.severity,
              source_ip: result.source_ip,
              message: result.message,
              related_event_ids: result.related_event_ids as any,
              status: 'OPEN',
              detected_at: new Date(),
            });
          }

          generatedAlerts.push(savedAlert);

          console.log(`🚨 [ALERT GENERATED] [${savedAlert.severity}] ${savedAlert.attack_type} from ${savedAlert.source_ip}`);

          // Append-only audit record for alert creation
          logAudit({
            actor: 'system',
            action: 'ALERT_CREATED',
            target: { type: 'ALERT', id: String(savedAlert._id) },
            metadata: {
              attack_type: savedAlert.attack_type,
              severity: savedAlert.severity,
              source_ip: savedAlert.source_ip,
              rule: result.rule_name,
            },
          }).catch(() => {});

          // Trigger broadcast handlers (Redis Pub/Sub, WebSockets, Cache invalidation)
          for (const handler of this.broadcastHandlers) {
            try {
              await handler(savedAlert);
            } catch (broadcastErr) {
              console.error('[DetectionEngine] Error in alert broadcast handler:', broadcastErr);
            }
          }
        } catch (saveErr) {
          console.error('[DetectionEngine] Failed to save generated alert:', saveErr);
        }
      }
    }

    return generatedAlerts;
  }
}

// Singleton instance
export const detectionEngine = new DetectionEngine();
export default detectionEngine;
