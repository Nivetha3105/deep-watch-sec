import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event';
import Alert from '../models/Alert';
import { getCache, setCache, CACHE_KEYS } from '../services/cacheService';
import { inMemoryStore } from '../services/inMemoryStore';

export interface AnalyticsSummary {
  total_events: number;
  total_alerts: number;
  severity_breakdown: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  attack_type_breakdown: Record<string, number>;
  top_attacker_ips: Array<{ ip: string; count: number }>;
  timeline: Array<{ time: string; events: number; alerts: number }>;
  cached_at?: string;
}

/**
 * Controller to fetch system security analytics summary.
 * Uses Redis caching layer with automatic invalidation, or in-memory fallback.
 * Endpoint: GET /api/analytics/summary
 */
export async function getAnalyticsSummary(req: Request, res: Response): Promise<void> {
  try {
    // 1. Check Redis Cache
    const cachedData = await getCache<AnalyticsSummary>(CACHE_KEYS.ANALYTICS_SUMMARY);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json({
        success: true,
        source: 'cache',
        data: cachedData,
      });
      return;
    }

    if (mongoose.connection.readyState !== 1) {
      // In-Memory Fallback
      const inMemSummary = inMemoryStore.getSummary();
      res.setHeader('X-Cache', 'MISS');
      res.status(200).json({
        success: true,
        source: 'in-memory',
        data: inMemSummary,
      });
      return;
    }

    // 2. Cache MISS: Run high-performance MongoDB aggregations
    const [
      totalEvents,
      totalAlerts,
      severityAgg,
      attackTypeAgg,
      topIpsAgg,
      recentAlertsTimeline,
    ] = await Promise.all([
      Event.countDocuments(),
      Alert.countDocuments(),
      Alert.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      Alert.aggregate([
        { $group: { _id: '$attack_type', count: { $sum: 1 } } },
      ]),
      Alert.aggregate([
        { $group: { _id: '$source_ip', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Alert.aggregate([
        {
          $match: {
            detected_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d %H:%M', date: '$detected_at' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 20 },
      ]),
    ]);

    // Format severity breakdown
    const severityMap: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    severityAgg.forEach((item) => {
      severityMap[item._id] = item.count;
    });

    // Format attack type breakdown
    const attackTypeMap: Record<string, number> = {};
    attackTypeAgg.forEach((item) => {
      attackTypeMap[item._id] = item.count;
    });

    // Format top attacker IPs
    const topAttackerIps = topIpsAgg.map((item) => ({
      ip: item._id,
      count: item.count,
    }));

    // Format timeline
    const timeline = recentAlertsTimeline.map((item) => ({
      time: item._id,
      events: 0,
      alerts: item.count,
    }));

    const responsePayload: AnalyticsSummary = {
      total_events: totalEvents,
      total_alerts: totalAlerts,
      severity_breakdown: {
        HIGH: severityMap.HIGH || 0,
        MEDIUM: severityMap.MEDIUM || 0,
        LOW: severityMap.LOW || 0,
      },
      attack_type_breakdown: attackTypeMap,
      top_attacker_ips: topAttackerIps,
      timeline,
      cached_at: new Date().toISOString(),
    };

    // 3. Store in Redis Cache (TTL = 60 seconds)
    await setCache(CACHE_KEYS.ANALYTICS_SUMMARY, responsePayload, 60);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json({
      success: true,
      source: 'database',
      data: responsePayload,
    });
  } catch (error: any) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to compute analytics summary',
    });
  }
}
