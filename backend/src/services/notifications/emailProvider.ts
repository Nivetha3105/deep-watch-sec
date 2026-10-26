import nodemailer from 'nodemailer';
import { INotificationProvider, NotificationAlert, NotificationResult, ProviderStatus } from './types';

export class EmailProvider implements INotificationProvider {
  public name = 'email';
  private transporter: nodemailer.Transporter | null = null;

  constructor(customTransporter?: nodemailer.Transporter) {
    if (customTransporter) {
      this.transporter = customTransporter;
    }
  }

  private getConfig() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.NOTIFICATION_EMAIL_FROM;
    const to = process.env.NOTIFICATION_EMAIL_TO;

    if (host && host.trim() && from && to) {
      return { host: host.trim(), port, user, pass, from: from.trim(), to: to.trim() };
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
      details: config ? { host: config.host, port: config.port, to: config.to } : undefined,
    };
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const config = this.getConfig();
    if (!config) return null;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.pass || '' } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });

    return this.transporter;
  }

  public async send(alert: NotificationAlert): Promise<NotificationResult> {
    const config = this.getConfig();
    const transporter = this.getTransporter();

    if (!config || !transporter) {
      return {
        provider: this.name,
        success: false,
        error: 'SMTP host or recipient email not configured',
      };
    }

    const subject = `[SentinelIDS Alert] [${alert.severity}] ${alert.attack_type} detected from ${alert.source_ip}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${alert.severity === 'HIGH' ? '#e11d48' : '#f59e0b'}; color: #ffffff; padding: 16px 20px;">
          <h2 style="margin: 0; font-size: 18px;">🚨 SentinelIDS Threat Alert</h2>
        </div>
        <div style="padding: 20px; color: #1e293b;">
          <p><strong>Attack Type:</strong> ${alert.attack_type}</p>
          <p><strong>Severity:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: bold;">${alert.severity}</span></p>
          <p><strong>Source IP:</strong> <code>${alert.source_ip}</code></p>
          <p><strong>Alert ID:</strong> <code>${alert.id}</code></p>
          <p><strong>Time:</strong> ${new Date(alert.detected_at).toUTCString()}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="color: #475569; font-size: 14px;">${alert.message}</p>
        </div>
      </div>
    `;

    let attempt = 0;
    const maxAttempts = 2; // At most 1 bounded retry

    while (attempt < maxAttempts) {
      attempt++;
      try {
        await transporter.sendMail({
          from: config.from,
          to: config.to,
          subject,
          text: `SentinelIDS Alert: [${alert.severity}] ${alert.attack_type} from ${alert.source_ip}\n\n${alert.message}\nTime: ${new Date(alert.detected_at).toISOString()}`,
          html,
        });

        return { provider: this.name, success: true, attempts: attempt };
      } catch (err: any) {
        if (attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, 500));
          continue;
        }
        return {
          provider: this.name,
          success: false,
          error: err.message || 'SMTP delivery failed',
          attempts: attempt,
        };
      }
    }

    return { provider: this.name, success: false, error: 'Max delivery attempts reached', attempts: attempt };
  }
}

export const emailProvider = new EmailProvider();
