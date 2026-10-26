import { Router, Request, Response } from 'express';
import { queryAuditLogs } from '../services/auditService';

const router = Router();

/**
 * GET /api/audit-logs
 * Read-only paginated endpoint for compliance audit records.
 * Supports filtering by action and actor.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, actor, page, limit } = req.query;

    const result = await queryAuditLogs({
      action: action as string,
      actor: actor as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('[AuditRoute] Error querying audit logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to query audit logs',
    });
  }
});

// NOTE: No POST, PUT, PATCH, or DELETE endpoints exist here.
// Audit records are strictly append-only and immutable.

export default router;
