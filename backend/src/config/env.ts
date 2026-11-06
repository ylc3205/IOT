import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load biến môi trường từ .env (nếu có)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Zod Schema xác thực toàn bộ biến môi trường bắt buộc của hệ thống.
 * Đảm bảo Fail-Fast: Ứng dụng sẽ dừng ngay khi khởi động nếu cấu hình sai hoặc thiếu.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(65535)),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // PostgreSQL Database Connection URL
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres_secure_pass@localhost:5432/smart_parking_db?schema=public'),

  // Eclipse Mosquitto MQTT Configuration
  MQTT_BROKER_URL: z.string().default('mqtt://localhost:1883'),
  MQTT_CLIENT_ID: z.string().default('smart-parking-backend-dev'),
  MQTT_USERNAME: z.string().default('smartparking_user'),
  MQTT_PASSWORD: z.string().default('smartparking_secret'),

  // JWT Configuration (Authentication & Authorization)
  JWT_SECRET: z.string().min(16).default('dev_jwt_secret_change_in_production_min32chars'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Mật khẩu quản trị viên mặc định khi nạp dữ liệu seed
  SEED_ADMIN_PASSWORD: z.string().default('Admin@123456'),

  // Cấu hình nghiệp vụ Phase 3 (Parking Session, Billing & Grace Period)
  DEFAULT_EXIT_GRACE_PERIOD_MINUTES: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative()),
  DEFAULT_ENTRY_TIMEOUT_SECONDS: z
    .string()
    .default('60')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive())
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Lỗi cấu hình biến môi trường (Environment Validation Failed):');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type EnvConfig = z.infer<typeof envSchema>;
