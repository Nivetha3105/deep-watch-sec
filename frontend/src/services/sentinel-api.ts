export type Severity = "HIGH" | "MEDIUM" | "LOW";
export type AlertStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";
export type AttackType = "BRUTE FORCE" | "PORT SCAN" | "DOS BURST";

export interface SecurityAlert {
  id: string;
  severity: Severity;
  attackType: AttackType;
  sourceIp: string;
  description: string;
  status: AlertStatus;
  timestamp: string;
  fresh?: boolean;
}

export interface AnalyticsSummary {
  telemetry: number;
  alerts: number;
  critical: number;
  actors: number;
  severity: Record<Severity, number>;
  vectors: Record<AttackType, number>;
  activity: { label: string; alerts: number; critical: number }[];
  topAttackers: { ip: string; count: number; lastSeen: string }[];
  daily: { day: string; alerts: number; resolved: number }[];
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function mapAlert(item: any): SecurityAlert {
  return {
    id: item._id ?? item.id,
    severity: item.severity,
    attackType: item.attack_type,
    sourceIp: item.source_ip,
    description: item.message,
    status: item.status ?? "OPEN",
    timestamp: item.detected_at
      ? new Date(item.detected_at).toLocaleTimeString("en-GB", {
          hour12: false,
        })
      : "",
  };
}

export const sentinelApi = {
  endpoints: {
    alerts: `${API_URL}/alerts`,
    summary: `${API_URL}/analytics/summary`,
    events: `${API_URL}/events`,
  },

  async getAlerts(): Promise<SecurityAlert[]> {
    const response = await fetch(`${API_URL}/alerts`);

    if (!response.ok) {
      throw new Error("Failed to fetch alerts");
    }

    const result = await response.json();

    return (result.data ?? []).map(mapAlert);
  },

  async getSummary(): Promise<AnalyticsSummary> {
    const response = await fetch(`${API_URL}/analytics/summary`);

    if (!response.ok) {
      throw new Error("Failed to fetch analytics");
    }

    const result = await response.json();
    const data = result.data;

    const severity = {
      HIGH: data.severity_breakdown?.HIGH ?? 0,
      MEDIUM: data.severity_breakdown?.MEDIUM ?? 0,
      LOW: data.severity_breakdown?.LOW ?? 0,
    };

    const vectors = {
      "BRUTE FORCE": data.attack_type_breakdown?.["BRUTE FORCE"] ?? 0,
      "PORT SCAN": data.attack_type_breakdown?.["PORT SCAN"] ?? 0,
      "DOS BURST": data.attack_type_breakdown?.["DOS BURST"] ?? 0,
    };

    const activity = (data.timeline ?? []).map((item: any) => ({
      label: item.time,
      alerts: item.alerts ?? 0,
      critical: 0,
    }));

    const topAttackers = (data.top_attacker_ips ?? []).map((item: any) => ({
      ip: item.ip,
      count: item.count,
      lastSeen: "",
    }));

    return {
      telemetry: data.total_events ?? 0,
      alerts: data.total_alerts ?? 0,

      // HIGH severity is treated as critical for the dashboard.
      critical: severity.HIGH,

      // Backend currently returns the top 5 attacker IPs.
      actors: topAttackers.length,

      severity,
      vectors,
      activity,
      topAttackers,

      // The current backend provides a 24-hour timeline,
      // not a 7-day daily breakdown.
      daily: [],
    };
  },

  async simulate(type: AttackType): Promise<SecurityAlert> {
    const events = createSimulationEvents(type);

    let lastAlert: SecurityAlert | null = null;

    for (const event of events) {
      const response = await fetch(`${API_URL}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Simulation failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.alert) {
        lastAlert = mapAlert(result.alert);
      }

      // Small delay so the detection engine can process
      // the events in sequence.
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    if (lastAlert) {
      return {
        ...lastAlert,
        fresh: true,
      };
    }

    return {
      id: `SIM-${Date.now()}`,
      severity:
        type === "PORT SCAN"
          ? "MEDIUM"
          : "HIGH",
      attackType: type,
      sourceIp: simulationIp[type],
      description: `${type} simulation completed`,
      status: "OPEN",
      timestamp: new Date().toLocaleTimeString("en-GB", {
        hour12: false,
      }),
      fresh: true,
    };
  },

  async resolveAlert(id: string) {
    const response = await fetch(`${API_URL}/alerts/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "RESOLVED" }),
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve alert: ${response.status}`);
    }

    return response.json();
  },

  async deleteAlert(id: string) {
    const response = await fetch(`${API_URL}/alerts/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete alert: ${response.status}`);
    }

    return response.json();
  },
};

const simulationIp: Record<AttackType, string> = {
  "BRUTE FORCE": "198.51.100.23",
  "PORT SCAN": "203.0.113.45",
  "DOS BURST": "198.51.100.99",
};

function createSimulationEvents(type: AttackType) {
  if (type === "BRUTE FORCE") {
    return Array.from({ length: 6 }, (_, index) => ({
      source_ip: "198.51.100.23",
      destination_ip: "10.0.0.1",
      port: 443,
      action: "LOGIN",
      result: "FAILED",
      timestamp: new Date().toISOString(),
      metadata: {
        attempt: index + 1,
        target_account: "admin",
        auth_method: "password",
      },
    }));
  }

  if (type === "PORT SCAN") {
    const ports = [
      21, 22, 23, 25, 80,
      110, 143, 443, 445, 1433,
      3306, 3389, 5432, 8080, 27017,
    ];

    return ports.map((port, index) => ({
      source_ip: "203.0.113.45",
      destination_ip: "10.0.0.2",
      port,
      action: "PORT_PROBE",
      result:
        port === 80 || port === 443
          ? "SUCCESS"
          : "BLOCKED",
      timestamp: new Date().toISOString(),
      metadata: {
        scan_type: "SYN_STEALTH",
        probe_id: index + 1,
      },
    }));
  }

  return Array.from({ length: 25 }, (_, index) => ({
    source_ip: "198.51.100.99",
    destination_ip: "10.0.0.5",
    port: 80,
    action: "HTTP_FLOOD",
    result: "FAILED",
    timestamp: new Date().toISOString(),
    metadata: {
      burst_id: index + 1,
      payload_size: 4096,
    },
  }));
}