export interface InMemoryEvent {
  _id: string;
  source_ip: string;
  destination_ip?: string | null;
  port?: number | null;
  action: string;
  result: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface InMemoryAlert {
  _id: string;
  attack_type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  source_ip: string;
  message: string;
  related_event_ids: string[];
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  assigned_to?: string | null;
  detected_at: Date;
}

class InMemoryStore {
  private events: InMemoryEvent[] = [];
  private alerts: InMemoryAlert[] = [];

  public saveEvent(data: Partial<InMemoryEvent>): InMemoryEvent {
    const event: InMemoryEvent = {
      _id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      source_ip: data.source_ip || '127.0.0.1',
      destination_ip: data.destination_ip || null,
      port: data.port || null,
      action: (data.action || '').toUpperCase(),
      result: (data.result || '').toUpperCase(),
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      metadata: data.metadata || {},
    };
    this.events.push(event);
    return event;
  }

  public findEvents(filter: {
    source_ip?: string;
    action?: string;
    result?: string;
    timestampGte?: Date;
  }): InMemoryEvent[] {
    return this.events.filter((e) => {
      if (filter.source_ip && e.source_ip !== filter.source_ip) return false;
      if (filter.action && e.action !== filter.action) return false;
      if (filter.result && e.result !== filter.result) return false;
      if (filter.timestampGte && e.timestamp < filter.timestampGte) return false;
      return true;
    });
  }

  public countEvents(filter: { source_ip?: string } = {}): number {
    if (filter.source_ip) {
      return this.events.filter((e) => e.source_ip === filter.source_ip).length;
    }
    return this.events.length;
  }

  public saveAlert(data: Partial<InMemoryAlert>): InMemoryAlert {
    const alert: InMemoryAlert = {
      _id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      attack_type: (data.attack_type || '').toUpperCase(),
      severity: (data.severity as any) || 'HIGH',
      source_ip: data.source_ip || '127.0.0.1',
      message: data.message || '',
      related_event_ids: (data.related_event_ids as any) || [],
      status: data.status || 'OPEN',
      detected_at: data.detected_at || new Date(),
    };
    this.alerts.push(alert);
    return alert;
  }

  public findAlerts(filter: {
    severity?: string;
    attack_type?: string;
    source_ip?: string;
    skip?: number;
    limit?: number;
  } = {}): { alerts: InMemoryAlert[]; total: number } {
    let filtered = [...this.alerts];
    if (filter.severity) {
      filtered = filtered.filter((a) => a.severity === filter.severity);
    }
    if (filter.attack_type) {
      filtered = filtered.filter((a) => a.attack_type === filter.attack_type);
    }
    if (filter.source_ip) {
      filtered = filtered.filter((a) => a.source_ip.includes(filter.source_ip!));
    }

    filtered.sort((a, b) => b.detected_at.getTime() - a.detected_at.getTime());
    const total = filtered.length;
    const skip = filter.skip || 0;
    const limit = filter.limit || 50;
    const paginated = filtered.slice(skip, skip + limit);

    return { alerts: paginated, total };
  }

  public findRecentAlert(source_ip: string, attack_type: string, sinceDate: Date): InMemoryAlert | null {
    return (
      this.alerts.find(
        (a) =>
          a.source_ip === source_ip &&
          a.attack_type === attack_type &&
          a.detected_at >= sinceDate
      ) || null
    );
  }

  public getSummary() {
    const severity_breakdown = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    const attack_type_breakdown: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};

    this.alerts.forEach((alert) => {
      severity_breakdown[alert.severity] = (severity_breakdown[alert.severity] || 0) + 1;
      attack_type_breakdown[alert.attack_type] = (attack_type_breakdown[alert.attack_type] || 0) + 1;
      ipCounts[alert.source_ip] = (ipCounts[alert.source_ip] || 0) + 1;
    });

    const top_attacker_ips = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total_events: this.events.length,
      total_alerts: this.alerts.length,
      severity_breakdown,
      attack_type_breakdown,
      top_attacker_ips,
      timeline: [],
      cached_at: new Date().toISOString(),
    };
  }

  public updateAlert(id: string, updates: Partial<InMemoryAlert>): InMemoryAlert | null {
    const alert = this.alerts.find((a) => a._id === id);
    if (!alert) return null;
    if (updates.status) alert.status = updates.status;
    if (updates.severity) alert.severity = updates.severity;
    if (updates.message) alert.message = updates.message;
    if (updates.assigned_to !== undefined) alert.assigned_to = updates.assigned_to;
    return alert;
  }

  public deleteAlert(id: string): boolean {
    const initialLen = this.alerts.length;
    this.alerts = this.alerts.filter((a) => a._id !== id);
    return this.alerts.length < initialLen;
  }

  private auditLogs: InMemoryAuditLog[] = [];

  public saveAuditLog(data: Partial<InMemoryAuditLog>): InMemoryAuditLog {
    const record: InMemoryAuditLog = {
      _id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actor: data.actor || 'system',
      action: data.action || 'NOTIFICATION_SENT',
      target: data.target || { type: 'ALERT', id: 'unknown' },
      metadata: data.metadata || {},
      created_at: data.created_at || new Date(),
    };
    this.auditLogs.unshift(record);
    return record;
  }

  public findAuditLogs(filter: {
    action?: string;
    actor?: string;
    skip?: number;
    limit?: number;
  } = {}): { logs: InMemoryAuditLog[]; total: number } {
    let filtered = [...this.auditLogs];
    if (filter.action) {
      filtered = filtered.filter((l) => l.action === filter.action);
    }
    if (filter.actor) {
      filtered = filtered.filter((l) => l.actor === filter.actor);
    }
    const total = filtered.length;
    const skip = filter.skip || 0;
    const limit = filter.limit || 50;
    const paginated = filtered.slice(skip, skip + limit);
    return { logs: paginated, total };
  }
}

export interface InMemoryAuditLog {
  _id: string;
  actor: string;
  action: string;
  target: { type: string; id: string };
  metadata: Record<string, any>;
  created_at: Date;
}

export const inMemoryStore = new InMemoryStore();
