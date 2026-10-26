import { Types } from 'mongoose';
import { IEvent } from '../models/Event';
import { AlertSeverity } from '../models/Alert';

export interface DetectionResult {
  triggered: boolean;
  rule_name: string;
  attack_type: string;
  severity: AlertSeverity;
  source_ip: string;
  message: string;
  related_event_ids: Types.ObjectId[];
  metadata?: Record<string, any>;
}

export interface IDetectionRule {
  name: string;
  description: string;
  evaluate(event: IEvent): Promise<DetectionResult | null>;
}
