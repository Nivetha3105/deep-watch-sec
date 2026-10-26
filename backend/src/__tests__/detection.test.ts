import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { BruteForceRule } from '../detection/rules/bruteForceRule';
import { PortScanRule } from '../detection/rules/portScanRule';
import { RequestBurstRule } from '../detection/rules/requestBurstRule';
import Event from '../models/Event';
import Alert from '../models/Alert';

describe('Intrusion Detection Engine Rules', () => {
  let bruteForce: BruteForceRule;
  let portScan: PortScanRule;
  let requestBurst: RequestBurstRule;

  beforeEach(() => {
    // Set readyState to 1 so unit tests evaluate Mongoose models
    (mongoose.connection as any).readyState = 1;
    bruteForce = new BruteForceRule();
    portScan = new PortScanRule();
    requestBurst = new RequestBurstRule();
  });

  describe('BruteForceRule', () => {
    it('should ignore non-LOGIN or SUCCESS events', async () => {
      const mockEvent: any = {
        source_ip: '192.168.1.50',
        action: 'API_REQUEST',
        result: 'FAILED',
      };
      const result = await bruteForce.evaluate(mockEvent);
      assert.strictEqual(result, null);

      const successEvent: any = {
        source_ip: '192.168.1.50',
        action: 'LOGIN',
        result: 'SUCCESS',
      };
      const successResult = await bruteForce.evaluate(successEvent);
      assert.strictEqual(successResult, null);
    });

    it('should trigger alert when failed login attempts reach threshold (>= 5)', async () => {
      // Mock Alert.findOne to simulate no recent cooldown
      const origAlertFindOne = Alert.findOne;
      Alert.findOne = (() => ({
        lean: async () => null,
      })) as any;

      // Mock Event.find to return 5 failed events
      const origEventFind = Event.find;
      const fakeEvents = [
        { _id: '1', timestamp: new Date() },
        { _id: '2', timestamp: new Date() },
        { _id: '3', timestamp: new Date() },
        { _id: '4', timestamp: new Date() },
        { _id: '5', timestamp: new Date() },
      ];
      Event.find = (() => ({
        select: () => ({
          lean: async () => fakeEvents,
        }),
      })) as any;

      const triggerEvent: any = {
        source_ip: '192.168.1.100',
        action: 'LOGIN',
        result: 'FAILED',
      };

      const result = await bruteForce.evaluate(triggerEvent);

      // Restore
      Alert.findOne = origAlertFindOne;
      Event.find = origEventFind;

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.triggered, true);
      assert.strictEqual(result?.attack_type, 'BRUTE_FORCE');
      assert.strictEqual(result?.severity, 'HIGH');
      assert.strictEqual(result?.source_ip, '192.168.1.100');
      assert.strictEqual(result?.related_event_ids.length, 5);
    });

    it('should NOT trigger alert when failed login attempts are below threshold (< 5)', async () => {
      const origAlertFindOne = Alert.findOne;
      Alert.findOne = (() => ({
        lean: async () => null,
      })) as any;

      const origEventFind = Event.find;
      const fakeEvents = [
        { _id: '1', timestamp: new Date() },
        { _id: '2', timestamp: new Date() },
        { _id: '3', timestamp: new Date() },
        { _id: '4', timestamp: new Date() },
      ];
      Event.find = (() => ({
        select: () => ({
          lean: async () => fakeEvents,
        }),
      })) as any;

      const triggerEvent: any = {
        source_ip: '192.168.1.100',
        action: 'LOGIN',
        result: 'FAILED',
      };

      const result = await bruteForce.evaluate(triggerEvent);

      Alert.findOne = origAlertFindOne;
      Event.find = origEventFind;

      assert.strictEqual(result, null);
    });

    it('should suppress alert if within cooldown window', async () => {
      // Mock Alert.findOne to return an existing recent alert
      const origAlertFindOne = Alert.findOne;
      Alert.findOne = (() => ({
        lean: async () => ({ _id: 'alert_123', detected_at: new Date() }),
      })) as any;

      const triggerEvent: any = {
        source_ip: '192.168.1.100',
        action: 'LOGIN',
        result: 'FAILED',
      };

      const result = await bruteForce.evaluate(triggerEvent);
      Alert.findOne = origAlertFindOne;

      assert.strictEqual(result, null);
    });
  });

  describe('PortScanRule', () => {
    it('should trigger alert when distinct probed ports >= 8', async () => {
      const origAlertFindOne = Alert.findOne;
      Alert.findOne = (() => ({
        lean: async () => null,
      })) as any;

      const origEventFind = Event.find;
      const fakeProbes = [21, 22, 23, 25, 80, 443, 3306, 8080].map((port, i) => ({
        _id: `evt_${i}`,
        port,
        action: 'PROBE',
        timestamp: new Date(),
      }));

      Event.find = (() => ({
        select: () => ({
          lean: async () => fakeProbes,
        }),
      })) as any;

      const triggerEvent: any = {
        source_ip: '10.0.0.50',
        port: 8080,
        action: 'PROBE',
      };

      const result = await portScan.evaluate(triggerEvent);

      Alert.findOne = origAlertFindOne;
      Event.find = origEventFind;

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.triggered, true);
      assert.strictEqual(result?.attack_type, 'PORT_SCAN');
      assert.strictEqual(result?.severity, 'MEDIUM');
      assert.strictEqual(result?.source_ip, '10.0.0.50');
      assert.strictEqual(result?.related_event_ids.length, 8);
    });
  });

  describe('RequestBurstRule', () => {
    it('should trigger alert when request velocity >= 20', async () => {
      const origAlertFindOne = Alert.findOne;
      Alert.findOne = (() => ({
        lean: async () => null,
      })) as any;

      const origEventFind = Event.find;
      const fakeBurst = Array.from({ length: 22 }, (_, i) => ({ _id: `id_${i}` }));

      Event.find = (() => ({
        select: () => ({
          lean: async () => fakeBurst,
        }),
      })) as any;

      const triggerEvent: any = {
        source_ip: '172.16.5.99',
        action: 'API_GET',
      };

      const result = await requestBurst.evaluate(triggerEvent);

      Alert.findOne = origAlertFindOne;
      Event.find = origEventFind;

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.triggered, true);
      assert.strictEqual(result?.attack_type, 'REQUEST_BURST');
      assert.strictEqual(result?.severity, 'HIGH');
      assert.strictEqual(result?.metadata?.request_count, 22);
    });
  });
});
