import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import healthRoutes from '../routes/healthRoutes';
import alertRoutes from '../routes/alertRoutes';

describe('API Smoke & Integration Tests', () => {
  it('GET /api/health should respond with status 200 and healthy status', async () => {
    const testApp = express();
    testApp.use('/api/health', healthRoutes);

    const server = testApp.listen(0);
    const address = server.address() as any;
    const port = address.port;

    const res = await fetch(`http://localhost:${port}/api/health`);
    const data = await res.json();

    server.close();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.services.api, 'healthy');
    assert.ok(typeof data.timestamp === 'string');
  });

  it('POST, PATCH, DELETE /api/alerts should create, resolve, and delete alerts', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/alerts', alertRoutes);

    const server = testApp.listen(0);
    const address = server.address() as any;
    const port = address.port;

    // 1. Create alert
    const createRes = await fetch(`http://localhost:${port}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attack_type: 'BRUTE FORCE',
        severity: 'HIGH',
        source_ip: '198.51.100.99',
        message: 'Test alert for verification',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    assert.ok(createData.data._id);
    const alertId = createData.data._id;

    // 2. Resolve alert
    const patchRes = await fetch(`http://localhost:${port}/api/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.strictEqual(patchData.data.status, 'RESOLVED');

    // 3. Delete alert
    const deleteRes = await fetch(`http://localhost:${port}/api/alerts/${alertId}`, {
      method: 'DELETE',
    });
    assert.strictEqual(deleteRes.status, 200);

    server.close();
  });
});
