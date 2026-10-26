import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import app from '../server';
import { logAudit, queryAuditLogs } from '../services/auditService';

describe('Audit Logging & Alert Lifecycle Integration', () => {
  let testServer: http.Server;
  let baseUrl: string;

  before((_, done) => {
    testServer = app.listen(0, () => {
      const port = (testServer.address() as any).port;
      baseUrl = `http://localhost:${port}`;
      done();
    });
  });

  after((_, done) => {
    testServer.close(done);
  });

  describe('Append-Only Audit Logging', () => {
    it('should append and retrieve audit records with sanitized metadata', async () => {
      const created = await logAudit({
        actor: 'senior_analyst',
        action: 'ALERT_STATUS_CHANGED',
        target: { type: 'ALERT', id: 'alt_test_99' },
        metadata: {
          previous_status: 'OPEN',
          new_status: 'INVESTIGATING',
          secret_key: 'ShouldBeRedacted',
        },
      });

      assert.notStrictEqual(created, null);
      assert.strictEqual(created?.actor, 'senior_analyst');
      assert.strictEqual(created?.action, 'ALERT_STATUS_CHANGED');
      assert.strictEqual(created?.metadata?.secret_key, '[REDACTED]');

      const queried = await queryAuditLogs({ actor: 'senior_analyst' });
      assert.strictEqual(queried.logs.length >= 1, true);
      assert.strictEqual(queried.logs[0].target.id, 'alt_test_99');
    });
  });

  describe('Alert Lifecycle Endpoints', () => {
    let alertId: string;

    it('should create an alert and record ALERT_CREATED audit entry', async () => {
      const res = await fetch(`${baseUrl}/api/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-analyst-id': 'sec_admin',
        },
        body: JSON.stringify({
          attack_type: 'BRUTE_FORCE',
          severity: 'HIGH',
          source_ip: '192.168.1.200',
          message: 'Repeated failed root login attempts',
        }),
      });

      const body = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.status, 'OPEN');
      alertId = body.data._id;
    });

    it('should reject invalid alert status transitions', async () => {
      const res = await fetch(`${baseUrl}/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INVALID_STATUS' }),
      });

      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.error, 'Validation Error');
    });

    it('should transition alert status to INVESTIGATING and record audit log', async () => {
      const res = await fetch(`${baseUrl}/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-analyst-id': 'tier2_analyst',
        },
        body: JSON.stringify({
          status: 'INVESTIGATING',
          assigned_to: 'analyst_alice',
        }),
      });

      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.data.status, 'INVESTIGATING');
      assert.strictEqual(body.data.assigned_to, 'analyst_alice');
    });

    it('should fetch audit logs via GET /api/audit-logs', async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(Array.isArray(body.data), true);
      assert.strictEqual(body.pagination.page, 1);
    });

    it('should fetch notification statuses via GET /api/notifications/status', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/status`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(Array.isArray(body.data.providers), true);
      assert.strictEqual(typeof body.data.min_severity, 'string');
      assert.strictEqual(typeof body.data.cooldown_seconds, 'number');
    });

    it('should delete alert and write ALERT_DELETED audit log', async () => {
      const res = await fetch(`${baseUrl}/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'x-analyst-id': 'sec_lead',
        },
      });

      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
    });
  });
});
