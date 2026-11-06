import { Response } from 'express';
import { ErrorCode } from '../errors/error-codes';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
  };
}

/**
 * Chuẩn hóa phản hồi thành công trả về CMS theo hợp đồng API:
 * { "success": true, "data": ... }
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data
  };
  return res.status(statusCode).json(payload);
}

/**
 * Chuẩn hóa phản hồi lỗi theo hợp đồng API:
 * { "success": false, "error": { "code": ..., "message": ... } }
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: ErrorCode | string,
  message: string,
  details?: unknown
): Response {
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {})
    }
  };
  return res.status(statusCode).json(payload);
}

