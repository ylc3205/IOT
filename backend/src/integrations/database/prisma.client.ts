import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/utils/logger';

/**
 * Singleton Prisma Client quản lý kết nối PostgreSQL.
 * Tái sử dụng connection pool và đảm bảo ngắt kết nối an toàn khi ứng dụng shutdown.
 */
class DatabaseService {
  private static instance: PrismaClient;

  public static getClient(): PrismaClient {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
      });
    }
    return DatabaseService.instance;
  }

  public static async disconnect(): Promise<void> {
    if (DatabaseService.instance) {
      logger.info('Đang đóng kết nối cơ sở dữ liệu PostgreSQL...');
      await DatabaseService.instance.$disconnect();
      logger.info('Đã ngắt kết nối PostgreSQL an toàn.');
    }
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const client = DatabaseService.getClient();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Kiểm tra kết nối PostgreSQL thất bại:', error);
      return false;
    }
  }
}

export const prisma = DatabaseService.getClient();
export const disconnectDatabase = DatabaseService.disconnect;
export const testDatabaseConnection = DatabaseService.testConnection;

