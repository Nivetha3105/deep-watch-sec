import { Router } from 'express';
import { getAnalyticsSummary } from '../controllers/analyticsController';

const router = Router();

// GET /api/analytics/summary - Cached security overview statistics
router.get('/summary', getAnalyticsSummary);

export default router;
