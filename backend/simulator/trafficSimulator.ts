/**
 * Network Traffic Simulator
 * Dispatches simulated normal telemetry and realistic cyber attack patterns
 * to the ingestion endpoint (POST /api/events).
 */

import {
  generateNormalEvent,
  generateBruteForceBatch,
  generatePortScanBatch,
  generateBurstBatch,
  NetworkEventPayload,
} from './attackScenarios';

const API_URL = process.env.API_URL || 'http://localhost:5000/api/events';

async function sendEvent(event: NetworkEventPayload): Promise<boolean> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (res.ok) {
      return true;
    } else {
      const err = await res.text();
      console.error(`[SIMULATOR] Error sending event: ${res.status} - ${err}`);
      return false;
    }
  } catch (error: any) {
    console.error(`[SIMULATOR] Connection failure to ${API_URL}: ${error.message}`);
    return false;
  }
}

async function sendBatch(name: string, events: NetworkEventPayload[]): Promise<void> {
  console.log(`\n🚨 >>> LAUNCHING SIMULATED ATTACK: [${name}] (${events.length} events) <<<`);
  for (const event of events) {
    const ok = await sendEvent(event);
    if (ok) {
      console.log(`   [${event.action}] from ${event.source_ip} -> port ${event.port || 'N/A'} [${event.result}]`);
    }
    // slight delay between requests in burst
    await new Promise((r) => setTimeout(r, 60));
  }
  console.log(`✅ [${name}] completed.\n`);
}

async function runContinuousSimulation() {
  console.log('========================================================');
  console.log('🌐 Network Intrusion Platform - Traffic Simulator');
  console.log(`🎯 Ingestion Target: ${API_URL}`);
  console.log('⚡ Generating continuous normal traffic with periodic attacks...');
  console.log('========================================================\n');

  let tick = 0;

  while (true) {
    tick++;

    // Generate normal baseline event
    const normal = generateNormalEvent();
    await sendEvent(normal);
    process.stdout.write(`.` );

    // Every 15 ticks (~15 sec), trigger an attack scenario
    if (tick % 15 === 0) {
      const attackType = (tick / 15) % 3;
      if (attackType === 1) {
        await sendBatch('BRUTE_FORCE_ATTACK', generateBruteForceBatch(6));
      } else if (attackType === 2) {
        await sendBatch('PORT_SCAN_ATTACK', generatePortScanBatch());
      } else {
        await sendBatch('BURST_FLOOD_ATTACK', generateBurstBatch(25));
      }
    }

    // Normal traffic cadence: 1 request every 800ms
    await new Promise((r) => setTimeout(r, 800));
  }
}

// Support CLI flags for direct one-shot attack execution
async function main() {
  const arg = process.argv[2];

  if (arg === '--brute-force') {
    await sendBatch('BRUTE_FORCE_ATTACK', generateBruteForceBatch(6));
    process.exit(0);
  } else if (arg === '--port-scan') {
    await sendBatch('PORT_SCAN_ATTACK', generatePortScanBatch());
    process.exit(0);
  } else if (arg === '--burst') {
    await sendBatch('BURST_FLOOD_ATTACK', generateBurstBatch(25));
    process.exit(0);
  } else if (arg === '--all-attacks') {
    await sendBatch('BRUTE_FORCE_ATTACK', generateBruteForceBatch(6));
    await new Promise((r) => setTimeout(r, 1000));
    await sendBatch('PORT_SCAN_ATTACK', generatePortScanBatch());
    await new Promise((r) => setTimeout(r, 1000));
    await sendBatch('BURST_FLOOD_ATTACK', generateBurstBatch(25));
    console.log('🎉 All attack scenarios simulated!');
    process.exit(0);
  } else {
    // Run continuous generator
    await runContinuousSimulation();
  }
}

main().catch((err) => {
  console.error('Fatal simulator error:', err);
  process.exit(1);
});
