import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * Health check endpoint: GET /api/health
 * Returns service status and MongoDB connection health
 */
router.get('/', (req: Request, res: Response) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      database: isDbConnected ? 'connected' : 'disconnected',
    },
  });
});

export default router;
