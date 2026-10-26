/**
 * Cooldown & Rate Limiting Service
 * 
 * Prevents notification floods by enforcing a configurable rate-limit cooldown
 * per unique combination of [attack_type + source_ip].
 */
export class CooldownService {
  private lastNotified = new Map<string, number>();
  private readonly defaultCooldownSeconds: number;

  constructor(defaultCooldownSeconds: number = 300) {
    const envVal = Number(process.env.NOTIFICATION_COOLDOWN_SECONDS);
    this.defaultCooldownSeconds = !isNaN(envVal) && envVal > 0 ? envVal : defaultCooldownSeconds;
  }

  private buildKey(attack_type: string, source_ip: string): string {
    return `${attack_type.toUpperCase()}:${source_ip.trim()}`;
  }

  /**
   * Check if this attack from source_ip is currently in the cooldown suppression window.
   */
  public isCoolingDown(attack_type: string, source_ip: string): boolean {
    const key = this.buildKey(attack_type, source_ip);
    const lastTime = this.lastNotified.get(key);
    if (!lastTime) {
      return false;
    }

    const elapsedMs = Date.now() - lastTime;
    const cooldownMs = this.defaultCooldownSeconds * 1000;
    return elapsedMs < cooldownMs;
  }

  /**
   * Record that a notification was dispatched, starting the cooldown timer.
   */
  public recordNotification(attack_type: string, source_ip: string): void {
    const key = this.buildKey(attack_type, source_ip);
    this.lastNotified.set(key, Date.now());

    // Prune entries older than 2x cooldown window to keep memory bounded
    if (this.lastNotified.size > 2000) {
      const cutoff = Date.now() - this.defaultCooldownSeconds * 2000;
      for (const [k, timestamp] of this.lastNotified.entries()) {
        if (timestamp < cutoff) {
          this.lastNotified.delete(k);
        }
      }
    }
  }

  /**
   * Clear cooldown cache (primarily for tests)
   */
  public reset(): void {
    this.lastNotified.clear();
  }

  public getCooldownSeconds(): number {
    return this.defaultCooldownSeconds;
  }
}

export const cooldownService = new CooldownService();
