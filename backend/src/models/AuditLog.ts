import mongoose, { Document, Schema } from 'mongoose';

export type AuditAction =
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED'
  | 'ALERT_STATUS_CHANGED'
  | 'ALERT_ASSIGNED'
  | 'ALERT_DELETED'
  | 'ALERT_CREATED';

export interface IAuditTarget {
  type: string; // e.g. 'ALERT', 'NOTIFICATION', 'EVENT'
  id: string;
}

export interface IAuditLog extends Document {
  actor: string;
  action: AuditAction;
  target: IAuditTarget;
  metadata: Record<string, any>;
  created_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: String,
      required: [true, 'Actor is required'],
      default: 'system',
      trim: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'NOTIFICATION_SENT',
        'NOTIFICATION_FAILED',
        'ALERT_STATUS_CHANGED',
        'ALERT_ASSIGNED',
        'ALERT_DELETED',
        'ALERT_CREATED',
      ],
      required: [true, 'Action is required'],
      index: true,
    },
    target: {
      type: {
        type: String,
        required: true,
        trim: true,
      },
      id: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    created_at: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

// Indexes for fast sorting and filtered history querying
AuditLogSchema.index({ created_at: -1 });
AuditLogSchema.index({ action: 1, created_at: -1 });
AuditLogSchema.index({ actor: 1, created_at: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
