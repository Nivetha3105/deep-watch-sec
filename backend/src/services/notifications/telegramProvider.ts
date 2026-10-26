import { INotificationProvider, NotificationAlert, NotificationResult, ProviderStatus } from './types';

export class TelegramProvider implements INotificationProvider {
  public name = 'telegram';
  private fetchFn: typeof fetch;

  constructor(customFetch?: typeof fetch) {
    this.fetchFn = customFetch || globalThis.fetch;
  }

  private getConfig(): { token: string; chatId: string } | null {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && token.trim() && chatId && chatId.trim()) {
      return { token: token.trim(), chatId: chatId.trim() };
    }
    return null;
  }

  public isEnabled(): boolean {
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_REAL_NOTIFICATIONS_FOR_TESTS) {
      return false;
    }
    return Boolean(this.getConfig());
  }

  public getStatus(): ProviderStatus {
    const config = this.getConfig();
    return {
      name: this.name,
      enabled: this.isEnabled(),
      configured: Boolean(config),
    };
  }

  public async send(alert: NotificationAlert): Promise<NotificationResult> {
    const config = this.getConfig();
    if (!config) {
      return {
        provider: this.name,
        success: false,
        error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured',
      };
    }

    const text = [
      `🚨 *SentinelIDS Threat Alert*`,
      `*Attack:* ${alert.attack_type}`,
      `*Severity:* ${alert.severity}`,
      `*Source IP:* \`${alert.source_ip}\``,
      `*Alert ID:* \`${alert.id}\``,
      `*Time:* ${new Date(alert.detected_at).toISOString()}`,
      ``,
      `_${alert.message}_`,
    ].join('\n');

    const url = `https://api.telegram.org/bot${config.token}/sendMessage`;
    const payload = {
      chat_id: config.chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };

    let attempt = 0;
    const maxAttempts = 2; // At most 1 bounded retry

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await this.fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return { provider: this.name, success: true, attempts: attempt };
        }

        // Rate limiting (429)
        if (response.status === 429) {
          if (attempt < maxAttempts) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
        }

        // Permanent client error
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return {
            provider: this.name,
            success: false,
            error: `Telegram client error: HTTP ${response.status}`,
            attempts: attempt,
          };
        }

        if (attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, 500));
          continue;
        }

        return {
          provider: this.name,
          success: false,
          error: `Telegram server error: HTTP ${response.status}`,
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
          error: err.name === 'AbortError' ? 'Telegram request timed out after 5000ms' : err.message || 'Network error',
          attempts: attempt,
        };
      }
    }

    return { provider: this.name, success: false, error: 'Max delivery attempts reached', attempts: attempt };
  }
}

export const telegramProvider = new TelegramProvider();
