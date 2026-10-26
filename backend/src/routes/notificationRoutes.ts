import { Router, Request, Response } from 'express';
import { notificationDispatcher } from '../services/notifications/notificationDispatcher';
import { cooldownService } from '../services/notifications/cooldownService';

const router = Router();

/**
 * GET /api/notifications/status
 * Returns sanitized status for all notification providers (Discord, Telegram, Email),
 * current minimum severity threshold, and active cooldown duration.
 * Strictly never exposes tokens, webhooks, or passwords.
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const providers = notificationDispatcher.getProviderStatuses();
    const minSeverity = notificationDispatcher.getMinimumSeverity();
    const cooldownSeconds = cooldownService.getCooldownSeconds();

    res.status(200).json({
      success: true,
      data: {
        providers,
        min_severity: minSeverity,
        cooldown_seconds: cooldownSeconds,
      },
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Error fetching notification status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch notification status',
    });
  }
});

export default router;
