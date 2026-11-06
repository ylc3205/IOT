import { describe, it, expect } from 'vitest';
import mqtt from 'mqtt';
import { env } from '../src/config/env';

describe('Controlled MQTT Integration Test against Live Mosquitto Broker', () => {
  it('should successfully publish and receive an event over MQTT with authentication', async () => {
    const client = mqtt.connect(env.MQTT_BROKER_URL, {
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
      clientId: `vitest_test_client_${Date.now()}`
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('error', (err) => reject(err));
    });

    const testTopic = 'smartparking/devices/test_node_01/events';
    const testPayload = {
      type: 'DEVICE_HEARTBEAT',
      deviceId: 'test_node_01',
      timestamp: Date.now(),
      payload: {
        firmwareVersion: '1.0.0-test',
        uptimeSeconds: 42,
        freeHeap: 180000,
        wifiRssi: -55
      }
    };

    const receivedMessage = await new Promise<string>((resolve) => {
      client.subscribe(testTopic, { qos: 1 }, () => {
        client.on('message', (_topic, message) => {
          resolve(message.toString());
        });

        client.publish(testTopic, JSON.stringify(testPayload), { qos: 1 });
      });
    });

    const parsed = JSON.parse(receivedMessage);
    expect(parsed.type).toBe('DEVICE_HEARTBEAT');
    expect(parsed.deviceId).toBe('test_node_01');
    expect(parsed.payload.firmwareVersion).toBe('1.0.0-test');

    client.end();
  });
});

