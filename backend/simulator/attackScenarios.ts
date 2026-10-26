/**
 * Network Traffic Attack Scenarios & Normal Behavior Profiles
 * Used by the Traffic Simulator to generate realistic telemetry.
 */

export interface NetworkEventPayload {
  source_ip: string;
  destination_ip?: string;
  port?: number;
  action: string;
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  timestamp?: string;
  metadata?: Record<string, any>;
}

// Normal employee / service IP pool
export const NORMAL_IPS = [
  '192.168.1.101',
  '192.168.1.102',
  '192.168.1.105',
  '192.168.1.120',
  '192.168.1.144',
  '10.0.1.15',
  '10.0.1.22',
];

// Target server endpoints
export const SERVER_IPS = ['10.0.0.1', '10.0.0.2', '10.0.0.5'];

// Attack IPs
export const BRUTE_FORCE_ATTACKER_IP = '198.51.100.23';
export const PORT_SCANNER_IP = '203.0.113.45';
export const BURST_FLOODER_IP = '198.51.100.99';

/**
 * Generate a random normal network event
 */
export function generateNormalEvent(): NetworkEventPayload {
  const actions = [
    { action: 'LOGIN', port: 443, resultProb: 0.95 },
    { action: 'API_REQUEST', port: 8080, resultProb: 0.98 },
    { action: 'FILE_ACCESS', port: 445, resultProb: 0.99 },
    { action: 'DATABASE_QUERY', port: 27017, resultProb: 0.99 },
    { action: 'DNS_LOOKUP', port: 53, resultProb: 1.0 },
    { action: 'HTTP_GET', port: 80, resultProb: 0.96 },
  ];

  const randomAction = actions[Math.floor(Math.random() * actions.length)];
  const sourceIp = NORMAL_IPS[Math.floor(Math.random() * NORMAL_IPS.length)];
  const destIp = SERVER_IPS[Math.floor(Math.random() * SERVER_IPS.length)];
  const isSuccess = Math.random() < randomAction.resultProb;

  return {
    source_ip: sourceIp,
    destination_ip: destIp,
    port: randomAction.port,
    action: randomAction.action,
    result: isSuccess ? 'SUCCESS' : 'FAILED',
    timestamp: new Date().toISOString(),
    metadata: {
      user_agent: 'Corporate-Workstation/1.0',
      protocol: randomAction.port === 53 ? 'UDP' : 'TCP',
    },
  };
}

/**
 * Generate a Brute-Force Login burst (6 rapid failed logins from same attacker)
 */
export function generateBruteForceBatch(count: number = 6): NetworkEventPayload[] {
  const events: NetworkEventPayload[] = [];
  const targetIp = SERVER_IPS[0];

  for (let i = 0; i < count; i++) {
    events.push({
      source_ip: BRUTE_FORCE_ATTACKER_IP,
      destination_ip: targetIp,
      port: 443,
      action: 'LOGIN',
      result: 'FAILED',
      timestamp: new Date(Date.now() - (count - i) * 200).toISOString(),
      metadata: {
        attempt: i + 1,
        target_account: 'admin',
        auth_method: 'password',
      },
    });
  }

  return events;
}

/**
 * Generate a Port Scanning pattern (rapid sequence of requests across differing ports)
 */
export function generatePortScanBatch(): NetworkEventPayload[] {
  const portsToScan = [21, 22, 23, 25, 80, 110, 143, 443, 445, 1433, 3306, 3389, 5432, 8080, 27017];
  const targetIp = SERVER_IPS[1];

  return portsToScan.map((port, idx) => ({
    source_ip: PORT_SCANNER_IP,
    destination_ip: targetIp,
    port: port,
    action: 'PORT_PROBE',
    result: port === 80 || port === 443 ? 'SUCCESS' : 'BLOCKED',
    timestamp: new Date(Date.now() - (portsToScan.length - idx) * 150).toISOString(),
    metadata: {
      scan_type: 'SYN_STEALTH',
      probe_id: idx + 1,
    },
  }));
}

/**
 * Generate a High-Rate Request Burst (DoS/Flooding pattern > 25 requests)
 */
export function generateBurstBatch(count: number = 25): NetworkEventPayload[] {
  const events: NetworkEventPayload[] = [];
  const targetIp = SERVER_IPS[2];

  for (let i = 0; i < count; i++) {
    events.push({
      source_ip: BURST_FLOODER_IP,
      destination_ip: targetIp,
      port: 80,
      action: 'HTTP_FLOOD',
      result: 'FAILED',
      timestamp: new Date(Date.now() - (count - i) * 80).toISOString(),
      metadata: {
        burst_id: i + 1,
        payload_size: 4096,
      },
    });
  }

  return events;
}
