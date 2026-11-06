import { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service';
import { sendSuccess } from '../../common/utils/api-response';

export class HealthController {
  /**
   * GET /api/health
   * Trả về kết quả liveness đúng chuẩn của đề bài:
   * { "success": true, "data": { "status": "ok", "service": "smart-parking-api" } }
   */
  public getHealth(_req: Request, res: Response, next: NextFunction): void {
    try {
      const data = healthService.getLiveness();
      sendSuccess(res, data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/health/ready
   * Chẩn đoán tình trạng tích hợp (PostgreSQL & Mosquitto)
   */
  public async getReadiness(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await healthService.getReadiness();
      const statusCode = data.status === 'ready' ? 200 : 503;
      sendSuccess(res, data, statusCode);
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
