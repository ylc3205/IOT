import { IClientOptions } from 'mqtt';
import { env } from '../../config/env';

/**
 * Cấu hình kết nối MQTT Client kết nối tới Eclipse Mosquitto Broker.
 * 
 * Lưu ý bảo mật kiến trúc:
 * 1. Tuyệt đối không lưu mật khẩu cứng trong mã nguồn (sử dụng biến môi trường env).
 * 2. Thiết lập reconnectPeriod để Client tự phục hồi kết nối khi Broker khởi động lại.
 * 3. clean: true đảm bảo phiên mới không bị kẹt các message cũ từ các phiên chạy dev trước.
 */
export const getMqttOptions = (): { brokerUrl: string; options: IClientOptions } => {
  const options: IClientOptions = {
    clientId: `${env.MQTT_CLIENT_ID}_${Math.random().toString(16).substring(2, 8)}`,
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000, // Tự động kết nối lại sau 3 giây nếu mất tín hiệu Broker
    keepalive: 60,
    rejectUnauthorized: false // Môi trường development
  };

  return {
    brokerUrl: env.MQTT_BROKER_URL,
    options
  };
};

