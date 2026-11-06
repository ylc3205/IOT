import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { sendError } from '../utils/api-response';
import { logger } from '../utils/logger';

/**
 * Centralized Error Handling Middleware:
 * Bắt toàn bộ ngoại lệ phát sinh từ controllers/services và chuyển đổi về cấu trúc lỗi thống nhất.
 * Đảm bảo hệ thống không bị lộ stack trace nhạy cảm ở môi trường production.
 */
export function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Xử lý lỗi do AppError định nghĩa có chủ đích
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.code}]: ${err.message}`, {
      path: req.originalUrl,
      details: err.details
    });
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // 2. Xử lý lỗi Schema Validation từ Zod
  if (err instanceof ZodError) {
    logger.warn(`Zod Validation Error on ${req.originalUrl}`, { issues: err.issues });
    sendError(
      res,
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Dữ liệu yêu cầu không hợp lệ (Validation Failed)',
      err.format()
    );
    return;
  }

  // 3. Xử lý lỗi cú pháp JSON trong request body
  if ('type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    sendError(res, 400, ErrorCodes.BAD_REQUEST, 'Cấu trúc JSON trong request body không hợp lệ.');
    return;
  }

  // 4. Ngoại lệ không xác định hoặc lỗi hệ thống nội bộ (500)
  logger.error(`Unhandled Exception on ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack
  });

  const message =
    process.env.NODE_ENV === 'production'
      ? 'Đã xảy ra lỗi hệ thống nội bộ. Vui lòng thử lại sau.'
      : err.message || 'Lỗi máy chủ nội bộ không xác định.';

  sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, message);
}
