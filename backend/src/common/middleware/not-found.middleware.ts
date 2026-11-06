import { Request, Response } from 'express';
import { sendError } from '../utils/api-response';
import { ErrorCodes } from '../errors/error-codes';

/**
 * 404 Not Found Middleware:
 * Xử lý các route không tồn tại trên Express, trả về JSON format chuẩn theo API conventions.
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(
    res,
    404,
    ErrorCodes.NOT_FOUND,
    `Route ${req.method} ${req.originalUrl} không tồn tại trên hệ thống.`
  );
}

