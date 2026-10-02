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
}

const seedAlerts: SecurityAlert[] = [
  { id: "ALR-9027", severity: "HIGH", attackType: "BRUTE FORCE", sourceIp: "192.168.1.50", description: "6 failed login attempts detected", status: "OPEN", timestamp: "06:14:38" },
  { id: "ALR-9026", severity: "MEDIUM", attackType: "PORT SCAN", sourceIp: "10.0.4.118", description: "Sequential scan across 24 service ports", status: "INVESTIGATING", timestamp: "06:12:09" },
  { id: "ALR-9025", severity: "HIGH", attackType: "DOS BURST", sourceIp: "172.16.0.88", description: "Request velocity exceeded 850 req/s", status: "OPEN", timestamp: "06:08:51" },
  { id: "ALR-9024", severity: "LOW", attackType: "PORT SCAN", sourceIp: "10.0.2.14", description: "Low-frequency discovery pattern observed", status: "RESOLVED", timestamp: "05:56:22" },
  { id: "ALR-9023", severity: "MEDIUM", attackType: "BRUTE FORCE", sourceIp: "192.168.8.207", description: "Authentication retry threshold exceeded", status: "INVESTIGATING", timestamp: "05:51:03" },
  { id: "ALR-9022", severity: "LOW", attackType: "PORT SCAN", sourceIp: "10.0.9.31", description: "Routine perimeter probe isolated", status: "RESOLVED", timestamp: "05:42:17" },
  { id: "ALR-9021", severity: "HIGH", attackType: "DOS BURST", sourceIp: "172.16.12.91", description: "SYN packet burst matched attack signature", status: "OPEN", timestamp: "05:37:44" },
];

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));
let records = [...seedAlerts];

const templates: Record<AttackType, Omit<SecurityAlert, "id" | "timestamp" | "fresh">> = {
  "BRUTE FORCE": { severity: "HIGH", attackType: "BRUTE FORCE", sourceIp: "192.168.1.50", description: "6 failed login attempts detected", status: "OPEN" },
  "PORT SCAN": { severity: "MEDIUM", attackType: "PORT SCAN", sourceIp: "10.0.4.118", description: "Sequential scan across 24 service ports", status: "OPEN" },
  "DOS BURST": { severity: "HIGH", attackType: "DOS BURST", sourceIp: "172.16.0.88", description: "Request velocity exceeded 850 req/s", status: "OPEN" },
};

export const sentinelApi = {
  endpoints: {
    alerts: "/api/alerts",
    summary: "/api/analytics/summary",
    alert: (id: string) => `/api/alerts/${id}`,
    simulate: (kind: string) => `/api/simulate/${kind}`,
  },
  async getAlerts() { await wait(); return [...records]; },
  async getSummary(): Promise<AnalyticsSummary> {
    await wait(200);
    return { telemetry: 2847391, alerts: 127, critical: 18, actors: 43, severity: { HIGH: 18, MEDIUM: 42, LOW: 67 }, vectors: { "BRUTE FORCE": 54, "PORT SCAN": 41, "DOS BURST": 32 } };
  },
  async simulate(type: AttackType) {
    await wait(180);
    const alert = { ...templates[type], id: `ALR-${9030 + records.length}`, timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }), fresh: true };
    records = [alert, ...records];
    return alert;
  },
  async resolveAlert(id: string) { await wait(220); records = records.map((item) => item.id === id ? { ...item, status: "RESOLVED" } : item); },
  async deleteAlert(id: string) { await wait(220); records = records.filter((item) => item.id !== id); },
  reset() { records = [...seedAlerts]; },
};
