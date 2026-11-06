/**
 * ==============================================================================
 * DỰ THẢO HỢP ĐỒNG DỮ LIỆU MQTT (DRAFT MQTT MESSAGE TYPES)
 * ==============================================================================
 * Các định dạng bản tin này được định nghĩa ở mức dự thảo cho Pha 0 Foundation,
 * sẽ được rà soát và thống nhất cùng đội ngũ phát triển phần cứng ESP32.
 * ==============================================================================
 */

export const MqttMessageTypes = {
  RFID_SCANNED: 'RFID_SCANNED',
  SENSOR_CHANGED: 'SENSOR_CHANGED',
  DEVICE_HEARTBEAT: 'DEVICE_HEARTBEAT',
  GATE_COMMAND: 'GATE_COMMAND',
  COMMAND_ACK: 'COMMAND_ACK',
  VEHICLE_PASSED: 'VEHICLE_PASSED'
} as const;

export type MqttMessageType = (typeof MqttMessageTypes)[keyof typeof MqttMessageTypes];

/**
 * Cấu trúc thông điệp chuẩn trao đổi qua MQTT
 */
export interface BaseMqttPayload<T = unknown> {
  type: MqttMessageType;
  deviceId: string;
  timestamp: number;
  payload: T;
}

export interface RfidScannedData {
  cardUid: string;
  gateType: 'ENTRY' | 'EXIT';
  readerId: string;
}

export interface SensorChangedData {
  slotId: string;
  isOccupied: boolean;
  distanceCm?: number;
}

export interface DeviceHeartbeatData {
  firmwareVersion: string;
  uptimeSeconds: number;
  freeHeap: number;
  wifiRssi: number;
}

export interface GateCommandData {
  commandId: string;
  action: 'OPEN_GATE' | 'CLOSE_GATE';
  gateId: string;
  timeoutMs?: number;
}

export interface CommandAckData {
  commandId: string;
  success: boolean;
  executedAt: number;
  errorMessage?: string;
}

export interface VehiclePassedData {
  gateId: string;
  direction: 'IN' | 'OUT';
  slotId?: string;
}

export type MqttMessageHandler<T = unknown> = (
  topic: string,
  payload: BaseMqttPayload<T>,
  rawPacket: Buffer
) => void | Promise<void>;

