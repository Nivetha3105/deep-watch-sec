import mongoose from 'mongoose';
import AuditLog, { AuditAction, IAuditLog, IAuditTarget } from '../models/AuditLog';
import { inMemoryStore, InMemoryAuditLog } from './inMemoryStore';

export interface AuditLogInput {
  actor?: string;
  action: AuditAction;
  target: IAuditTarget;
  metadata?: Record<string, any>;
}

const SENSITIVE_KEYS = new Set([
  'token',
  'password',
  'secret',
  'authorization',
  'webhook',
  'cookie',
  'smtp_password',
  'bot_token',
]);

/**
 * Recursively sanitize metadata to remove sensitive credentials, tokens, or secrets.
 */
export function sanitizeMetadata(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('webhook') ||
      lowerKey.includes('auth')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Append-only audit logger.
 * Safe to call from any context; never throws or crashes the host process.
 */
export async function logAudit(entry: AuditLogInput): Promise<IAuditLog | InMemoryAuditLog | null> {
  try {
    const actor = entry.actor && entry.actor.trim() ? entry.actor.trim() : 'system';
    const metadata = sanitizeMetadata(entry.metadata || {});

    if (mongoose.connection.readyState === 1) {
      const record = new AuditLog({
        actor,
        action: entry.action,
        target: entry.target,
        metadata,
        created_at: new Date(),
      });
      const saved = await record.save();
      return saved;
    } else {
      const saved = inMemoryStore.saveAuditLog({
        actor,
        action: entry.action,
        target: entry.target,
        metadata,
        created_at: new Date(),
      });
      return saved;
    }
  } catch (err) {
    // Crucial: Audit logging error must not crash ingestion or notification worker
    console.error('[AuditService] Failed to record audit log entry:', err);
    return null;
  }
}

/**
 * Fetch paginated audit logs with filtering by action, actor, or date.
 */
export async function queryAuditLogs(params: {
  action?: string;
  actor?: string;
  page?: number;
  limit?: number;
}) {
  const pageNum = Math.max(1, Number(params.page || 1));
  const limitNum = Math.min(100, Math.max(1, Number(params.limit || 50)));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    const filter: Record<string, any> = {};
    if (params.action) {
      filter.action = params.action;
    }
    if (params.actor) {
      filter.actor = params.actor;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  } else {
    const { logs, total } = inMemoryStore.findAuditLogs({
      action: params.action,
      actor: params.actor,
      skip,
      limit: limitNum,
    });

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}
