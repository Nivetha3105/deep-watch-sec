import { AlertSeverity } from '../../models/Alert';
import { logAudit } from '../auditService';
import { cooldownService } from './cooldownService';
import { discordProvider } from './discordProvider';
import { emailProvider } from './emailProvider';
import { telegramProvider } from './telegramProvider';
import { INotificationProvider, NotificationAlert, NotificationResult, ProviderStatus } from './types';

export const SEVERITY_WEIGHTS: Record<AlertSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export class NotificationDispatcher {
  private providers: INotificationProvider[] = [];

  constructor(customProviders?: INotificationProvider[]) {
    this.providers = customProviders || [discordProvider, telegramProvider, emailProvider];
  }

  public registerProvider(provider: INotificationProvider): void {
    this.providers.push(provider);
  }

  public getMinimumSeverity(): AlertSeverity {
    const raw = (process.env.NOTIFICATION_MIN_SEVERITY || 'HIGH').toUpperCase() as AlertSeverity;
    return SEVERITY_WEIGHTS[raw] !== undefined ? raw : 'HIGH';
  }

  public shouldNotify(severity: AlertSeverity): boolean {
    const minSeverity = this.getMinimumSeverity();
    const alertWeight = SEVERITY_WEIGHTS[severity] ?? 0;
    const minWeight = SEVERITY_WEIGHTS[minSeverity] ?? 3;
    return alertWeight >= minWeight;
  }

  public getProviderStatuses(): ProviderStatus[] {
    return this.providers.map((p) => p.getStatus());
  }

  /**
   * Dispatch notification to all active providers.
   * Safe execution: Never throws, logs audit records, obeys severity rules and cooldowns.
   */
  public async dispatchAlert(rawAlert: any): Promise<{
    skipped?: boolean;
    reason?: string;
    results: NotificationResult[];
  }> {
    if (!rawAlert) {
      return { skipped: true, reason: 'Empty alert payload', results: [] };
    }

    const alertId = String(rawAlert._id || rawAlert.id || 'unknown');
    const attackType = String(rawAlert.attack_type || rawAlert.attackType || 'UNKNOWN').toUpperCase();
    const severity = String(rawAlert.severity || 'LOW').toUpperCase() as AlertSeverity;
    const sourceIp = String(rawAlert.source_ip || rawAlert.sourceIp || 'unknown');
    const message = String(rawAlert.message || rawAlert.description || 'Threat detected');
    const detectedAt = rawAlert.detected_at || rawAlert.timestamp || new Date();

    // 1. Severity filter check
    if (!this.shouldNotify(severity)) {
      return {
        skipped: true,
        reason: `Severity ${severity} is below configured threshold ${this.getMinimumSeverity()}`,
        results: [],
      };
    }

    // 2. Cooldown deduplication check
    if (cooldownService.isCoolingDown(attackType, sourceIp)) {
      return {
        skipped: true,
        reason: `Alert for ${attackType} from ${sourceIp} is within cooldown window`,
        results: [],
      };
    }

    // Sanitized incident details (no passwords, tokens, or raw request data)
    const sanitizedAlert: NotificationAlert = {
      id: alertId,
      attack_type: attackType,
      severity,
      source_ip: sourceIp,
      message,
      detected_at: detectedAt,
    };

    // Filter to active providers
    const activeProviders = this.providers.filter((p) => p.isEnabled());
    if (activeProviders.length === 0) {
      return {
        skipped: true,
        reason: 'No notification providers currently configured or enabled',
        results: [],
      };
    }

    const results: NotificationResult[] = [];
    let anyDelivered = false;

    for (const provider of activeProviders) {
      try {
        const res = await provider.send(sanitizedAlert);
        results.push(res);

        if (res.success) {
          anyDelivered = true;
          await logAudit({
            actor: 'system',
            action: 'NOTIFICATION_SENT',
            target: { type: 'ALERT', id: alertId },
            metadata: {
              provider: provider.name,
              attack_type: attackType,
              severity,
              attempts: res.attempts || 1,
            },
          });
        } else {
          await logAudit({
            actor: 'system',
            action: 'NOTIFICATION_FAILED',
            target: { type: 'ALERT', id: alertId },
            metadata: {
              provider: provider.name,
              attack_type: attackType,
              severity,
              error: res.error,
              attempts: res.attempts || 1,
            },
          });
        }
      } catch (err: any) {
        console.error(`[NotificationDispatcher] Error dispatching to ${provider.name}:`, err);
        const failResult: NotificationResult = {
          provider: provider.name,
          success: false,
          error: err.message || 'Unknown provider error',
        };
        results.push(failResult);

        await logAudit({
          actor: 'system',
          action: 'NOTIFICATION_FAILED',
          target: { type: 'ALERT', id: alertId },
          metadata: {
            provider: provider.name,
            attack_type: attackType,
            severity,
            error: err.message,
          },
        });
      }
    }

    if (anyDelivered) {
      cooldownService.recordNotification(attackType, sourceIp);
    }

    return { skipped: false, results };
  }
}

export const notificationDispatcher = new NotificationDispatcher();
