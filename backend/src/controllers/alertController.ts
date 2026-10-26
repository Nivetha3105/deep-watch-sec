import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Alert, { AlertStatus } from '../models/Alert';
import { inMemoryStore } from '../services/inMemoryStore';
import { logAudit } from '../services/auditService';
import { invalidateCache, CACHE_KEYS } from '../services/cacheService';
import { broadcastAlertUpdated, broadcastAlertDeleted } from '../services/socketService';

/**
 * Controller to fetch alerts with filtering and pagination.
 * Endpoint: GET /api/alerts
 */
export async function getAlerts(req: Request, res: Response): Promise<void> {
  try {
    const { severity, attack_type, source_ip, startDate, endDate, limit = 50, page = 1 } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    if (mongoose.connection.readyState === 1) {
      const filter: Record<string, any> = {};

      if (severity) {
        filter.severity = (severity as string).toUpperCase();
      }
      if (attack_type) {
        filter.attack_type = (attack_type as string).toUpperCase();
      }
      if (source_ip) {
        filter.source_ip = source_ip;
      }
      if (startDate || endDate) {
        filter.detected_at = {};
        if (startDate) {
          filter.detected_at.$gte = new Date(startDate as string);
        }
        if (endDate) {
          filter.detected_at.$lte = new Date(endDate as string);
        }
      }

      const [alerts, total] = await Promise.all([
        Alert.find(filter)
          .sort({ detected_at: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate('related_event_ids')
          .lean(),
        Alert.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: alerts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } else {
      const { alerts, total } = inMemoryStore.findAlerts({
        severity: severity ? (severity as string).toUpperCase() : undefined,
        attack_type: attack_type ? (attack_type as string).toUpperCase() : undefined,
        source_ip: source_ip as string,
        skip,
        limit: limitNum,
      });

      res.status(200).json({
        success: true,
        data: alerts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch alerts',
    });
  }
}

/**
 * Controller to manually create an alert.
 * Endpoint: POST /api/alerts
 */
export async function createAlert(req: Request, res: Response): Promise<void> {
  try {
    const { attack_type, severity, source_ip, message, related_event_ids, status, assigned_to } = req.body;
    const actor = (req.headers['x-analyst-id'] as string) || (req.headers['x-user-id'] as string) || 'analyst';

    if (!attack_type || !severity || !source_ip || !message) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'attack_type, severity, source_ip, and message are required fields.',
      });
      return;
    }

    let savedAlert: any;

    if (mongoose.connection.readyState === 1) {
      const alert = new Alert({
        attack_type: attack_type.toUpperCase(),
        severity: severity.toUpperCase(),
        source_ip,
        message,
        related_event_ids: related_event_ids || [],
        status: status || 'OPEN',
        assigned_to: assigned_to || null,
        detected_at: new Date(),
      });
      savedAlert = await alert.save();
    } else {
      savedAlert = inMemoryStore.saveAlert({
        attack_type,
        severity,
        source_ip,
        message,
        related_event_ids,
        status,
        detected_at: new Date(),
      });
    }

    // Record audit log
    await logAudit({
      actor,
      action: 'ALERT_CREATED',
      target: { type: 'ALERT', id: String(savedAlert._id) },
      metadata: {
        attack_type: savedAlert.attack_type,
        severity: savedAlert.severity,
        source_ip: savedAlert.source_ip,
      },
    });

    // Invalidate analytics cache
    await invalidateCache(CACHE_KEYS.ANALYTICS_SUMMARY);

    res.status(201).json({
      success: true,
      data: savedAlert,
    });
  } catch (error: any) {
    console.error('Error creating alert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to create alert',
    });
  }
}

const VALID_STATUSES: AlertStatus[] = ['OPEN', 'INVESTIGATING', 'RESOLVED'];

/**
 * Controller to update an alert (status transition, assignment, message).
 * Endpoint: PATCH /api/alerts/:id
 */
export async function updateAlert(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, severity, message, assigned_to } = req.body;
    const actor = (req.headers['x-analyst-id'] as string) || (req.headers['x-user-id'] as string) || 'analyst';

    if (status && !VALID_STATUSES.includes(status.toUpperCase() as AlertStatus)) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Invalid status '${status}'. Allowed statuses are: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    let previousStatus: string | null = null;
    let updatedAlert: any = null;

    if (mongoose.connection.readyState === 1) {
      const existing = await Alert.findById(id);
      if (!existing) {
        res.status(404).json({
          error: 'Not Found',
          message: `Alert with id ${id} not found`,
        });
        return;
      }
      previousStatus = existing.status;

      const updateData: Record<string, any> = {};
      if (status) updateData.status = status.toUpperCase();
      if (severity) updateData.severity = severity.toUpperCase();
      if (message) updateData.message = message;
      if (assigned_to !== undefined) updateData.assigned_to = assigned_to;

      updatedAlert = await Alert.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
    } else {
      const existing = inMemoryStore.findAlerts({ limit: 1 }).alerts.find((a) => a._id === id);
      if (existing) {
        previousStatus = existing.status;
      }
      updatedAlert = inMemoryStore.updateAlert(id, { status, severity, message, assigned_to });
    }

    if (!updatedAlert) {
      res.status(404).json({
        error: 'Not Found',
        message: `Alert with id ${id} not found`,
      });
      return;
    }

    // Write audit records for state mutations
    if (status && status.toUpperCase() !== previousStatus) {
      await logAudit({
        actor,
        action: 'ALERT_STATUS_CHANGED',
        target: { type: 'ALERT', id: String(id) },
        metadata: {
          previous_status: previousStatus,
          new_status: status.toUpperCase(),
        },
      });
    }

    if (assigned_to !== undefined) {
      await logAudit({
        actor,
        action: 'ALERT_ASSIGNED',
        target: { type: 'ALERT', id: String(id) },
        metadata: {
          assigned_to,
        },
      });
    }

    // Invalidate cached analytics and broadcast real-time socket update
    await invalidateCache(CACHE_KEYS.ANALYTICS_SUMMARY);
    broadcastAlertUpdated(updatedAlert);

    res.status(200).json({
      success: true,
      message: 'Alert updated successfully',
      data: updatedAlert,
    });
  } catch (error: any) {
    console.error('Error updating alert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to update alert',
    });
  }
}

/**
 * Controller to delete an alert.
 * Endpoint: DELETE /api/alerts/:id
 */
export async function deleteAlert(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const actor = (req.headers['x-analyst-id'] as string) || (req.headers['x-user-id'] as string) || 'analyst';
    let deleted = false;

    if (mongoose.connection.readyState === 1) {
      const result = await Alert.findByIdAndDelete(id);
      deleted = Boolean(result);
    } else {
      deleted = inMemoryStore.deleteAlert(id);
    }

    if (!deleted) {
      res.status(404).json({
        error: 'Not Found',
        message: `Alert with id ${id} not found`,
      });
      return;
    }

    // Write audit record
    await logAudit({
      actor,
      action: 'ALERT_DELETED',
      target: { type: 'ALERT', id: String(id) },
      metadata: {
        deleted_at: new Date().toISOString(),
      },
    });

    // Invalidate cache and broadcast deletion
    await invalidateCache(CACHE_KEYS.ANALYTICS_SUMMARY);
    broadcastAlertDeleted(id);

    res.status(200).json({
      success: true,
      message: `Alert ${id} deleted successfully`,
    });
  } catch (error: any) {
    console.error('Error deleting alert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to delete alert',
    });
  }
}


