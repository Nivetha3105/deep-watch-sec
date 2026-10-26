import { INotificationProvider, NotificationAlert, NotificationResult, ProviderStatus } from './types';

export class DiscordProvider implements INotificationProvider {
  public name = 'discord';
  private fetchFn: typeof fetch;

  constructor(customFetch?: typeof fetch) {
    this.fetchFn = customFetch || globalThis.fetch;
  }

  public getWebhookUrl(): string | null {
    const url = process.env.DISCORD_WEBHOOK_URL;
    return url && url.trim().startsWith('https://discord.com/api/webhooks') ? url.trim() : null;
  }

  public isEnabled(): boolean {
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_REAL_NOTIFICATIONS_FOR_TESTS) {
      return false;
    }
    return Boolean(this.getWebhookUrl());
  }

  public getStatus(): ProviderStatus {
    const url = this.getWebhookUrl();
    return {
      name: this.name,
      enabled: this.isEnabled(),
      configured: Boolean(url),
    };
  }

  public async send(alert: NotificationAlert): Promise<NotificationResult> {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      return {
        provider: this.name,
        success: false,
        error: 'DISCORD_WEBHOOK_URL not configured',
      };
    }

    const payload = {
      username: 'SentinelIDS Alert Bot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/2092/2092663.png',
      embeds: [
        {
          title: `🚨 [${alert.severity}] Intrusion Alert: ${alert.attack_type}`,
          description: alert.message,
          color: alert.severity === 'HIGH' ? 0xe11d48 : alert.severity === 'MEDIUM' ? 0xf59e0b : 0x10b981,
          fields: [
            { name: 'Attack Type', value: alert.attack_type, inline: true },
            { name: 'Severity', value: alert.severity, inline: true },
            { name: 'Source IP', value: `\`${alert.source_ip}\``, inline: true },
            { name: 'Alert ID', value: `\`${alert.id}\``, inline: true },
            { name: 'Detected At', value: new Date(alert.detected_at).toUTCString(), inline: false },
          ],
          footer: {
            text: 'SentinelIDS Real-Time Threat Prevention',
          },
        },
      ],
    };

    let attempt = 0;
    const maxAttempts = 2; // At most 1 bounded retry

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await this.fetchFn(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok || response.status === 204) {
          return { provider: this.name, success: true, attempts: attempt };
        }

        // Rate limited
        if (response.status === 429) {
          console.warn(`[DiscordProvider] Rate limited (429) on attempt ${attempt}`);
          if (attempt < maxAttempts) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
        }

        // Permanent client error (400, 401, 403, 404) - do not retry
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return {
            provider: this.name,
            success: false,
            error: `Discord client error: HTTP ${response.status}`,
            attempts: attempt,
          };
        }

        // Server error (5xx)
        if (attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, 500));
          continue;
        }

        return {
          provider: this.name,
          success: false,
          error: `Discord server error: HTTP ${response.status}`,
          attempts: attempt,
        };
      } catch (err: any) {
        if (attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, 500));
          continue;
        }
        return {
          provider: this.name,
          success: false,
          error: err.name === 'AbortError' ? 'Discord request timed out after 5000ms' : err.message || 'Network error',
          attempts: attempt,
        };
      }
    }

    return { provider: this.name, success: false, error: 'Max delivery attempts reached', attempts: attempt };
  }
}

export const discordProvider = new DiscordProvider();
