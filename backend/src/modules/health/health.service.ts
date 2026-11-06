import { testDatabaseConnection } from '../../integrations/database/prisma.client';
import { mqttClient } from '../../integrations/mqtt/mqtt.client';

export interface HealthStatus {
  status: 'ok';
  service: 'smart-parking-api';
  timestamp?: string;
  uptime?: number;
}

export interface ReadinessStatus {
  status: 'ready' | 'degraded';
  database: 'connected' | 'disconnected';
  mqtt: 'connected' | 'disconnected';
  timestamp: string;
}

export class HealthService {
  /**
   * Liveness Check: Độc lập hoàn toàn với MQTT và Database.
   * Dùng cho orchestrator/balancer kiểm tra container/process có đang sống không.
   */
  public getLiveness(): HealthStatus {
    return {
      status: 'ok',
      service: 'smart-parking-api'
    };
  }

  /**
   * Readiness Check: Kiểm tra chi tiết trạng thái kết nối Database và MQTT Broker.
   */
  public async getReadiness(): Promise<ReadinessStatus> {
    const dbOk = await testDatabaseConnection();
    const mqttOk = mqttClient.isConnected();

    return {
      status: dbOk && mqttOk ? 'ready' : 'degraded',
      database: dbOk ? 'connected' : 'disconnected',
      mqtt: mqttOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    };
  }
}

export const healthService = new HealthService();

