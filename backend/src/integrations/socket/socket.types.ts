/**
 * ==============================================================================
 * SOCKET.IO EVENT DEFINITIONS (PHASE 0 FOUNDATION)
 * ==============================================================================
 * Các sự kiện realtime được chuẩn hóa để CMS Web nhận cập nhật tức thời
 * mà không cần liên tục gửi request thăm dò (polling).
 * ==============================================================================
 */

export const SocketEvents = {
  // Hệ thống kết nối và chẩn đoán
  SYSTEM_STATUS: 'system:status',
  CLIENT_CONNECTED: 'client:connected',
  CLIENT_DISCONNECTED: 'client:disconnected',

  // Placeholder cho các sự kiện bãi đỗ xe (sẽ hiện thực ở các pha sau)
  SLOT_UPDATED_PREVIEW: 'parking:slot_preview',
  DEVICE_STATUS_PREVIEW: 'devices:status_preview'
} as const;

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface SystemStatusSocketPayload {
  uptime: number;
  activeSockets: number;
  mqttConnected: boolean;
  timestamp: string;
}

