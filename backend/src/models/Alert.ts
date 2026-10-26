import mongoose, { Document, Schema, Types } from 'mongoose';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export interface IAlert extends Document {
  attack_type: string;
  severity: AlertSeverity;
  source_ip: string;
  message: string;
  related_event_ids: Types.ObjectId[];
  status: AlertStatus;
  assigned_to?: string | null;
  detected_at: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    attack_type: {
      type: String,
      required: [true, 'attack_type is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: [true, 'severity is required'],
      index: true,
    },
    source_ip: {
      type: String,
      required: [true, 'source_ip is required'],
      trim: true,
      index: true,
    },
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
    },
    related_event_ids: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Event',
      },
    ],
    status: {
      type: String,
      enum: ['OPEN', 'INVESTIGATING', 'RESOLVED'],
      default: 'OPEN',
      required: true,
      index: true,
    },
    assigned_to: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    detected_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

// Chronological index to fetch recent alerts fast for live feeds and dashboards
AlertSchema.index({ detected_at: -1 });

// Compound index for filtering by severity over time
AlertSchema.index({ severity: 1, detected_at: -1 });

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);
export default Alert;
