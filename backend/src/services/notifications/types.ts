import { AlertSeverity } from '../../models/Alert';

export interface NotificationAlert {
  id: string;
  attack_type: string;
  severity: AlertSeverity;
  source_ip: string;
  message: string;
  detected_at: string | Date;
}

export interface NotificationResult {
  provider: string;
  success: boolean;
  error?: string;
  attempts?: number;
}

export interface ProviderStatus {
  name: string;
  enabled: boolean;
  configured: boolean;
  details?: Record<string, any>;
}

export interface INotificationProvider {
  name: string;
  isEnabled(): boolean;
  send(alert: NotificationAlert): Promise<NotificationResult>;
  getStatus(): ProviderStatus;
}
