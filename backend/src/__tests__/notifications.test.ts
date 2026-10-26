import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NotificationDispatcher, SEVERITY_WEIGHTS } from '../services/notifications/notificationDispatcher';
import { CooldownService } from '../services/notifications/cooldownService';
import { DiscordProvider } from '../services/notifications/discordProvider';
import { TelegramProvider } from '../services/notifications/telegramProvider';
import { EmailProvider } from '../services/notifications/emailProvider';
import { INotificationProvider, NotificationAlert } from '../services/notifications/types';
import { sanitizeMetadata } from '../services/auditService';

describe('Notification Pipeline & Worker Tests', () => {
  describe('Severity-Based Rules & Thresholds', () => {
    it('should respect severity weighting: HIGH (3) > MEDIUM (2) > LOW (1)', () => {
      assert.strictEqual(SEVERITY_WEIGHTS.HIGH > SEVERITY_WEIGHTS.MEDIUM, true);
      assert.strictEqual(SEVERITY_WEIGHTS.MEDIUM > SEVERITY_WEIGHTS.LOW, true);
    });

    it('should filter out alerts below minimum severity threshold', async () => {
      process.env.NOTIFICATION_MIN_SEVERITY = 'HIGH';
      const sentAlerts: NotificationAlert[] = [];

      const mockProvider: INotificationProvider = {
        name: 'mock',
        isEnabled: () => true,
        getStatus: () => ({ name: 'mock', enabled: true, configured: true }),
        send: async (a) => {
          sentAlerts.push(a);
          return { provider: 'mock', success: true };
        },
      };

      const dispatcher = new NotificationDispatcher([mockProvider]);

      // MEDIUM severity should be skipped when min is HIGH
      const mediumResult = await dispatcher.dispatchAlert({
        id: 'alt_1',
        attack_type: 'PORT_SCAN',
        severity: 'MEDIUM',
        source_ip: '10.0.0.1',
        message: 'Port scan detected',
      });
      assert.strictEqual(mediumResult.skipped, true);
      assert.strictEqual(sentAlerts.length, 0);

      // HIGH severity should pass through
      const highResult = await dispatcher.dispatchAlert({
        id: 'alt_2',
        attack_type: 'BRUTE_FORCE',
        severity: 'HIGH',
        source_ip: '10.0.0.2',
        message: 'Brute force detected',
      });
      assert.strictEqual(highResult.skipped, false);
      assert.strictEqual(sentAlerts.length, 1);
      assert.strictEqual(sentAlerts[0].attack_type, 'BRUTE_FORCE');
    });
  });

  describe('Cooldown & Rate Limiting', () => {
    it('should enforce cooldown window per attack_type and source_ip', () => {
      const cooldown = new CooldownService(60); // 60s cooldown
      cooldown.reset();

      assert.strictEqual(cooldown.isCoolingDown('BRUTE_FORCE', '192.168.1.1'), false);
      cooldown.recordNotification('BRUTE_FORCE', '192.168.1.1');
      assert.strictEqual(cooldown.isCoolingDown('BRUTE_FORCE', '192.168.1.1'), true);

      // Different IP or different attack type should not be blocked
      assert.strictEqual(cooldown.isCoolingDown('BRUTE_FORCE', '192.168.1.2'), false);
      assert.strictEqual(cooldown.isCoolingDown('PORT_SCAN', '192.168.1.1'), false);
    });
  });

  describe('Metadata Sanitization & Secret Redaction', () => {
    it('should redact sensitive keys (password, token, webhook, secret)', () => {
      const raw = {
        username: 'admin',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOi...',
        discord_webhook: 'https://discord.com/api/webhooks/...',
        nested: {
          api_secret: 'xyz123',
          safe_field: 'valid',
        },
      };

      const sanitized = sanitizeMetadata(raw);
      assert.strictEqual(sanitized.username, 'admin');
      assert.strictEqual(sanitized.password, '[REDACTED]');
      assert.strictEqual(sanitized.token, '[REDACTED]');
      assert.strictEqual(sanitized.discord_webhook, '[REDACTED]');
      assert.strictEqual(sanitized.nested.api_secret, '[REDACTED]');
      assert.strictEqual(sanitized.nested.safe_field, 'valid');
    });
  });

  describe('Discord Provider Mock Delivery & Retry', () => {
    it('should deliver payload successfully and return attempts count', async () => {
      let called = 0;
      const fakeFetch: any = async () => {
        called++;
        return { ok: true, status: 204 };
      };

      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';
      const discord = new DiscordProvider(fakeFetch);

      const alert: NotificationAlert = {
        id: '1',
        attack_type: 'BRUTE_FORCE',
        severity: 'HIGH',
        source_ip: '10.0.0.5',
        message: '5 failed logins',
        detected_at: new Date(),
      };

      const res = await discord.send(alert);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.attempts, 1);
      assert.strictEqual(called, 1);
    });

    it('should retry once on transient 429 rate limit or 500 error', async () => {
      let attempts = 0;
      const fakeFetch: any = async () => {
        attempts++;
        if (attempts === 1) {
          return { ok: false, status: 500 };
        }
        return { ok: true, status: 200 };
      };

      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';
      const discord = new DiscordProvider(fakeFetch);

      const alert: NotificationAlert = {
        id: '1',
        attack_type: 'BRUTE_FORCE',
        severity: 'HIGH',
        source_ip: '10.0.0.5',
        message: '5 failed logins',
        detected_at: new Date(),
      };

      const res = await discord.send(alert);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.attempts, 2);
      assert.strictEqual(attempts, 2);
    });

    it('should NOT retry permanent 400 client errors', async () => {
      let attempts = 0;
      const fakeFetch: any = async () => {
        attempts++;
        return { ok: false, status: 400 };
      };

      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';
      const discord = new DiscordProvider(fakeFetch);

      const alert: NotificationAlert = {
        id: '1',
        attack_type: 'BRUTE_FORCE',
        severity: 'HIGH',
        source_ip: '10.0.0.5',
        message: '5 failed logins',
        detected_at: new Date(),
      };

      const res = await discord.send(alert);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.attempts, 1);
      assert.strictEqual(attempts, 1);
    });
  });

  describe('Telegram Provider Mock Delivery', () => {
    it('should format message with markdown and send to Telegram API', async () => {
      let requestedUrl = '';
      let requestedBody = '';

      const fakeFetch: any = async (url: string, opts: any) => {
        requestedUrl = url;
        requestedBody = opts.body;
        return { ok: true, status: 200 };
      };

      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.TELEGRAM_CHAT_ID = '123456789';

      const telegram = new TelegramProvider(fakeFetch);
      const alert: NotificationAlert = {
        id: 'alt_tg_1',
        attack_type: 'PORT_SCAN',
        severity: 'HIGH',
        source_ip: '192.168.1.99',
        message: 'Probing 15 ports',
        detected_at: new Date(),
      };

      const res = await telegram.send(alert);
      assert.strictEqual(res.success, true);
      assert.strictEqual(requestedUrl.includes('test_token'), true);
      const parsed = JSON.parse(requestedBody);
      assert.strictEqual(parsed.chat_id, '123456789');
      assert.strictEqual(parsed.text.includes('PORT_SCAN'), true);
    });
  });

  describe('Email Provider Mock Delivery', () => {
    it('should send email using transport and handle delivery results', async () => {
      let mailSent = false;
      const fakeTransporter: any = {
        sendMail: async (opts: any) => {
          mailSent = true;
          assert.strictEqual(opts.subject.includes('SentinelIDS Alert'), true);
          return { messageId: 'msg_123' };
        },
      };

      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.NOTIFICATION_EMAIL_FROM = 'alerts@sentinelids.local';
      process.env.NOTIFICATION_EMAIL_TO = 'analyst@sentinelids.local';

      const email = new EmailProvider(fakeTransporter);
      const alert: NotificationAlert = {
        id: 'alt_mail_1',
        attack_type: 'DOS_BURST',
        severity: 'HIGH',
        source_ip: '198.51.100.4',
        message: 'Velocity spike',
        detected_at: new Date(),
      };

      const res = await email.send(alert);
      assert.strictEqual(res.success, true);
      assert.strictEqual(mailSent, true);
    });
  });
});
