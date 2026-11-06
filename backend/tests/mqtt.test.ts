import { describe, it, expect } from 'vitest';
import { matchTopic } from '../src/integrations/mqtt/mqtt.client';
import { MqttMessageTypes } from '../src/integrations/mqtt/mqtt.types';

describe('MQTT Integration Unit Tests', () => {
  describe('matchTopic helper', () => {
    it('should match exact topics', () => {
      expect(matchTopic('smartparking/devices/esp32_01/events', 'smartparking/devices/esp32_01/events')).toBe(true);
      expect(matchTopic('smartparking/devices/esp32_01/events', 'smartparking/devices/esp32_02/events')).toBe(false);
    });

    it('should match single-level wildcard (+)', () => {
      const pattern = 'smartparking/devices/+/events';
      expect(matchTopic(pattern, 'smartparking/devices/esp32_01/events')).toBe(true);
      expect(matchTopic(pattern, 'smartparking/devices/esp32_gate_in/events')).toBe(true);
      expect(matchTopic(pattern, 'smartparking/devices/esp32_01/commands')).toBe(false);
      expect(matchTopic(pattern, 'smartparking/devices/esp32_01/sub/events')).toBe(false);
    });

    it('should match multi-level wildcard (#)', () => {
      const pattern = 'smartparking/#';
      expect(matchTopic(pattern, 'smartparking/devices/esp32_01/events')).toBe(true);
      expect(matchTopic(pattern, 'smartparking/system/health')).toBe(true);
      expect(matchTopic(pattern, 'other/devices/esp32_01')).toBe(false);
    });
  });

  describe('MQTT Message Types Contract', () => {
    it('should have all required draft message types defined', () => {
      expect(MqttMessageTypes.RFID_SCANNED).toBe('RFID_SCANNED');
      expect(MqttMessageTypes.SENSOR_CHANGED).toBe('SENSOR_CHANGED');
      expect(MqttMessageTypes.DEVICE_HEARTBEAT).toBe('DEVICE_HEARTBEAT');
      expect(MqttMessageTypes.GATE_COMMAND).toBe('GATE_COMMAND');
      expect(MqttMessageTypes.COMMAND_ACK).toBe('COMMAND_ACK');
      expect(MqttMessageTypes.VEHICLE_PASSED).toBe('VEHICLE_PASSED');
    });
  });
});

