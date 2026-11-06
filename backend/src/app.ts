import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { notFoundMiddleware } from './common/middleware/not-found.middleware';
import { errorMiddleware } from './common/middleware/error.middleware';
import { healthRouter } from './modules/health/health.router';
import { authRouter } from './modules/auth/auth.router';
import { parkingLotRouter } from './modules/parking-lots/parking-lot.router';
import { parkingSlotRouter } from './modules/parking-slots/parking-slot.router';
import { vehicleRouter } from './modules/vehicles/vehicle.router';
import { rfidRouter } from './modules/rfid-cards/rfid.router';
import { pricingRouter } from './modules/pricing/pricing.router';

/**
 * Khởi tạo ứng dụng Express (Application Bootstrap).
 * Tách biệt cấu hình Express khỏi Server Startup để phục vụ việc kiểm thử tự động (Unit / Integration Tests)
 * bằng supertest mà không cần chiếm dụng cổng mạng vật lý.
 */
export function createApp(): Application {
  const app: Application = express();

  // 1. Cấu hình bảo mật HTTP Security Headers bằng Helmet
  app.use(helmet());

  // 2. Cấu hình bảo mật Cross-Origin Resource Sharing (CORS)
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  );

  // 3. Parser Body dạng JSON và URL-encoded
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // 4. Middleware ghi log Request HTTP
  app.use(requestLoggerMiddleware);

  // 5. Đăng ký các Router nghiệp vụ cốt lõi (Core Business Modules)
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/parking-lots', parkingLotRouter);
  app.use('/api/parking-slots', parkingSlotRouter);
  app.use('/api/vehicles', vehicleRouter);
  app.use('/api/rfid-cards', rfidRouter);
  app.use('/api/pricing-rules', pricingRouter);

  // 6. Middleware xử lý 404 Not Found
  app.use(notFoundMiddleware);

  // 7. Middleware bắt lỗi tập trung (Centralized Error Handler)
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();

