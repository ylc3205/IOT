import mqtt, { MqttClient as RawMqttClient, IClientPublishOptions } from 'mqtt';
import { getMqttOptions } from './mqtt.config';
import { BaseMqttPayload, MqttMessageHandler } from './mqtt.types';
import { logger } from '../../common/utils/logger';

/**
 * Hàm kiểm tra so khớp MQTT Topic hỗ trợ wildcard '+' (single-level) và '#' (multi-level).
 */
export function matchTopic(pattern: string, topic: string): boolean {
  if (pattern === topic || pattern === '#') return true;

  const patternSegments = pattern.split('/');
  const topicSegments = topic.split('/');

  for (let i = 0; i < patternSegments.length; i++) {
    const p = patternSegments[i];
    if (p === '#') {
      return true; // '#' đại diện cho tất cả các level còn lại
    }
    if (p !== '+' && p !== topicSegments[i]) {
      return false;
    }
  }

  return patternSegments.length === topicSegments.length;
}

/**
 * Lớp quản trị kết nối MQTT Client (MQTT Service Layer).
 * Đảm nhiệm:
 * - Khởi tạo và giám sát chu kỳ kết nối (Lifecycle Management).
 * - Tự động tái kết nối khi rớt mạng (Resilience).
 * - Phân phối thông điệp (Publish/Subscribe Router).
 * - Thực thi các quy chuẩn an ninh (không cho phép retain các lệnh điều khiển cổng).
 */
export class MqttService {
  private client: RawMqttClient | null = null;
  private isConnecting = false;
  private subscriptions: Map<string, Set<MqttMessageHandler>> = new Map();

  /**
   * Khởi tạo kết nối tới Mosquitto Broker
   */
  public async connect(): Promise<RawMqttClient> {
    if (this.client && this.client.connected) {
      return this.client;
    }

    if (this.isConnecting) {
      logger.info('MQTT Client đang trong tiến trình kết nối...');
      return new Promise((resolve, reject) => {
        this.client?.once('connect', () => resolve(this.client!));
        this.client?.once('error', (err) => reject(err));
      });
    }

    this.isConnecting = true;
    const { brokerUrl, options } = getMqttOptions();

    logger.info(`Đang khởi tạo kết nối MQTT tới Broker: ${brokerUrl} (Client ID: ${options.clientId})`);

    return new Promise((resolve, reject) => {
      try {
        const client = mqtt.connect(brokerUrl, options);
        this.client = client;

        client.on('connect', (connack) => {
          this.isConnecting = false;
          logger.info(`✅ Kết nối MQTT Broker thành công! Session Present: ${connack.sessionPresent}`);

          // Đăng ký lại toàn bộ topic đã theo dõi sau khi tái kết nối (Resubscribe)
          for (const topic of this.subscriptions.keys()) {
            client.subscribe(topic, { qos: 1 }, (err) => {
              if (err) {
                logger.error(`Lỗi resubscribe topic "${topic}" sau tái kết nối:`, err.message);
              } else {
                logger.debug(`Đã resubscribe thành công topic "${topic}"`);
              }
            });
          }

          resolve(client);
        });

        client.on('reconnect', () => {
          logger.warn('🔄 Đang thử kết nối lại với MQTT Broker...');
        });

        client.on('close', () => {
          logger.warn('⚠️ Kết nối MQTT Broker đã bị đóng.');
        });

        client.on('offline', () => {
          logger.warn('⚠️ MQTT Client đang ở trạng thái Offline.');
        });

        client.on('error', (err) => {
          this.isConnecting = false;
          logger.error(`❌ Lỗi MQTT Client: ${err.message}`);
          // Không throw để tránh crash toàn bộ ứng dụng nếu Mosquitto chưa kịp start
        });

        client.on('message', (topic, rawMessage, packet) => {
          this.handleIncomingMessage(topic, rawMessage, packet);
        });
      } catch (err) {
        this.isConnecting = false;
        logger.error('Lỗi ngoại lệ khi tạo MQTT Client:', err);
        reject(err);
      }
    });
  }

  /**
   * Xử lý điều hướng thông điệp đến các bộ lắng nghe (Subscription Handlers)
   */
  private handleIncomingMessage(topic: string, rawMessage: Buffer, _packet: unknown): void {
    const rawString = rawMessage.toString('utf-8');

    let parsedPayload: BaseMqttPayload;
    try {
      parsedPayload = JSON.parse(rawString);
    } catch {
      logger.warn(`Bản tin MQTT tại topic "${topic}" không phải định dạng JSON hợp lệ: ${rawString}`);
      return;
    }

    // Kiểm tra cấu trúc bản tin tối thiểu
    if (!parsedPayload.type || !parsedPayload.deviceId) {
      logger.warn(`Bản tin MQTT tại topic "${topic}" thiếu trường bắt buộc (type, deviceId):`, parsedPayload);
      return;
    }

    // Duyệt qua các subscription pattern và gọi handler nếu khớp topic
    for (const [pattern, handlers] of this.subscriptions.entries()) {
      if (matchTopic(pattern, topic)) {
        for (const handler of handlers) {
          try {
            handler(topic, parsedPayload, rawMessage);
          } catch (handlerErr) {
            logger.error(`Lỗi xảy ra trong MQTT Handler cho topic "${topic}":`, handlerErr);
          }
        }
      }
    }
  }

  /**
   * Đăng ký lắng nghe thông điệp từ topic
   */
  public subscribe<T = unknown>(
    topic: string,
    handler: MqttMessageHandler<T>,
    qos: 0 | 1 | 2 = 1
  ): void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());

      if (this.client && this.client.connected) {
        this.client.subscribe(topic, { qos }, (err) => {
          if (err) {
            logger.error(`Không thể subscribe topic "${topic}":`, err.message);
          } else {
            logger.info(`Đã subscribe thành công topic: "${topic}" (QoS ${qos})`);
          }
        });
      }
    }

    this.subscriptions.get(topic)!.add(handler as MqttMessageHandler);
  }

  /**
   * Hủy đăng ký lắng nghe topic
   */
  public unsubscribe(topic: string, handler?: MqttMessageHandler): void {
    const handlers = this.subscriptions.get(topic);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(topic);
        if (this.client && this.client.connected) {
          this.client.unsubscribe(topic);
        }
      }
    } else {
      this.subscriptions.delete(topic);
      if (this.client && this.client.connected) {
        this.client.unsubscribe(topic);
      }
    }
  }

  /**
   * Xuất bản (Publish) thông điệp lên Broker.
   *
   * Quy tắc an ninh nghiêm ngặt:
   * Tuyệt đối không cho phép cờ retain=true với các lệnh điều khiển cổng (commands/GATE_COMMAND),
   * tránh tình trạng cổng tự động mở ngoài ý muốn khi thiết bị khởi động lại và nhận lệnh cũ!
   */
  public async publish<T = unknown>(
    topic: string,
    message: BaseMqttPayload<T> | Record<string, unknown> | string,
    options: IClientPublishOptions = { qos: 1 }
  ): Promise<void> {
    if (!this.client || !this.client.connected) {
      logger.warn(`Không thể publish tới "${topic}": MQTT Client chưa kết nối.`);
      return;
    }

    // Bảo mật: Chặn cờ retain trên lệnh điều khiển
    if (options.retain && (topic.includes('/commands') || topic.includes('GATE_COMMAND'))) {
      logger.error(`BẢO MẬT VI PHẠM: Từ chối cờ retain=true trên lệnh điều khiển tới topic "${topic}"`);
      options.retain = false;
    }

    const payloadString = typeof message === 'string' ? message : JSON.stringify(message);

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, payloadString, options, (err) => {
        if (err) {
          logger.error(`Lỗi khi publish message tới topic "${topic}":`, err.message);
          reject(err);
        } else {
          logger.debug(`Đã publish thành công tới "${topic}"`);
          resolve();
        }
      });
    });
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  public isConnected(): boolean {
    return Boolean(this.client && this.client.connected);
  }

  /**
   * Đóng kết nối an toàn khi hệ thống dừng hoạt động (Graceful Shutdown)
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      logger.info('Đang đóng kết nối MQTT Client...');
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          logger.info('Đã ngắt kết nối MQTT Client an toàn.');
          this.client = null;
          resolve();
        });
      });
    }
  }
}

export const mqttClient = new MqttService();
