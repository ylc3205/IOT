import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './common/utils/logger';
import { socketService } from './integrations/socket/socket.server';
import { mqttClient } from './integrations/mqtt/mqtt.client';
import { disconnectDatabase, testDatabaseConnection } from './integrations/database/prisma.client';

/**
 * Điểm khởi chạy chính của Backend (HTTP Server Startup).
 * Gắn kết Express App, Socket.IO và khởi động kết nối MQTT / Database.
 */
async function bootstrap(): Promise<void> {
  const httpServer = http.createServer(app);

  // 1. Gắn kết Socket.IO Server vào HTTP Server
  socketService.init(httpServer);

  // 2. Lắng nghe trên cổng đã cấu hình
  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Smart Parking Backend đang chạy tại http://localhost:${env.PORT}`);
    logger.info(`📡 Health Check Endpoint: http://localhost:${env.PORT}/api/health`);
    logger.info(`🌍 Môi trường: ${env.NODE_ENV}`);
  });

  // 3. Khởi tạo kết nối nền tới MQTT Broker (Bất đồng bộ)
  mqttClient.connect().catch((err) => {
    logger.warn('⚠️ Chưa thể kết nối tới MQTT Broker ngay lúc khởi động:', err.message);
  });

  // 4. Kiểm tra sơ bộ kết nối Database
  testDatabaseConnection().then((connected) => {
    if (connected) {
      logger.info('✅ Kết nối PostgreSQL sẵn sàng.');
    } else {
      logger.warn('⚠️ Chưa thể kết nối PostgreSQL. Vui lòng kiểm tra Docker container.');
    }
  });

  // 5. Cấu hình Graceful Shutdown khi nhận tín hiệu kết thúc quy trình
  const handleShutdown = async (signal: string) => {
    logger.info(`\n🛑 Nhận tín hiệu ${signal}. Đang tiến hành dừng hệ thống an toàn (Graceful Shutdown)...`);

    // Dừng nhận request HTTP mới
    httpServer.close(async () => {
      logger.info('Đã dừng nhận request HTTP.');

      try {
        // Đóng Socket.IO
        await socketService.close();

        // Ngắt kết nối MQTT
        await mqttClient.disconnect();

        // Đóng kết nối Database
        await disconnectDatabase();

        logger.info('✅ Toàn bộ tài nguyên đã được giải phóng an toàn. Kết thúc tiến trình.');
        process.exit(0);
      } catch (err) {
        logger.error('Lỗi xảy ra trong quá trình shutdown:', err);
        process.exit(1);
      }
    });

    // Force exit nếu shutdown quá 10 giây
    setTimeout(() => {
      logger.error('Quá thời gian chờ shutdown an toàn (Timeout 10s). Buộc dừng tiến trình.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Lỗi nghiêm trọng khi khởi động máy chủ:', err);
  process.exit(1);
});

