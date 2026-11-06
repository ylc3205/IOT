import { ErrorCode, ErrorCodes } from './error-codes';

/**
 * Lớp lỗi chuẩn của ứng dụng (AppError).
 * Kế thừa Error chuẩn của JS, bổ sung HTTP statusCode và ErrorCode có ngữ nghĩa
 * giúp Frontend hiển thị thông báo chính xác và hỗ trợ truy vết lỗi.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    // Giữ nguyên Stack Trace chính xác
    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(
    message: string,
    code: ErrorCode = ErrorCodes.BAD_REQUEST,
    details?: unknown
  ): AppError {
    return new AppError(message, 400, code, details);
  }

  public static unauthorized(
    message = 'Yêu cầu không được xác thực',
    code: ErrorCode = ErrorCodes.UNAUTHORIZED,
    details?: unknown
  ): AppError {
    return new AppError(message, 401, code, details);
  }

  public static forbidden(
    message = 'Không có quyền truy cập tài nguyên',
    code: ErrorCode = ErrorCodes.FORBIDDEN,
    details?: unknown
  ): AppError {
    return new AppError(message, 403, code, details);
  }

  public static notFound(
    message = 'Resource not found',
    code: ErrorCode = ErrorCodes.NOT_FOUND
  ): AppError {
    return new AppError(message, 404, code);
  }

  public static conflict(
    message = 'Xung đột dữ liệu',
    code: ErrorCode = ErrorCodes.CONFLICT,
    details?: unknown
  ): AppError {
    return new AppError(message, 409, code, details);
  }

  public static internal(
    message = 'Internal server error occurred',
    details?: unknown
  ): AppError {
    return new AppError(message, 500, ErrorCodes.INTERNAL_SERVER_ERROR, details);
  }
}

