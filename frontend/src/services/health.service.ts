import { apiClient } from './api.client';

export interface HealthData {
  status: 'ok';
  service: 'smart-parking-api';
}

export interface ReadinessData {
  status: 'ready' | 'degraded';
  database: 'connected' | 'disconnected';
  mqtt: 'connected' | 'disconnected';
  timestamp: string;
}

export const healthService = {
  getLiveness: async (): Promise<{ success: boolean; data: HealthData }> => {
    return apiClient.get('/health');
  },

  getReadiness: async (): Promise<{ success: boolean; data: ReadinessData }> => {
    return apiClient.get('/health/ready');
  }
};

