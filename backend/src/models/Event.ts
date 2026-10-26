import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  source_ip: string;
  destination_ip?: string;
  port?: number;
  action: string;
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  timestamp: Date;
  metadata?: Record<string, any>;
}

const EventSchema = new Schema<IEvent>(
  {
    source_ip: {
      type: String,
      required: [true, 'source_ip is required'],
      trim: true,
      index: true,
    },
    destination_ip: {
      type: String,
      trim: true,
      default: null,
    },
    port: {
      type: Number,
      min: [1, 'Port must be between 1 and 65535'],
      max: [65535, 'Port must be between 1 and 65535'],
      default: null,
    },
    action: {
      type: String,
      required: [true, 'action is required'],
      trim: true,
      uppercase: true,
    },
    result: {
      type: String,
      required: [true, 'result is required'],
      enum: ['SUCCESS', 'FAILED', 'BLOCKED'],
      uppercase: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    versionKey: false,
  }
);

// Compound index for fast time-window queries per IP (used heavily by rule-based detection engine)
EventSchema.index({ source_ip: 1, timestamp: -1 });

// Compound index for quick lookup of specific action outcomes (e.g. failed logins) within time ranges
EventSchema.index({ action: 1, result: 1, timestamp: -1 });

// Chronological index for timeline analytics and time-series aggregations
EventSchema.index({ timestamp: -1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);
export default Event;
