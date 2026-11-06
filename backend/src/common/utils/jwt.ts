import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  fullName?: string | null;
}

/**
 * Tạo mới JWT Token có thời hạn cho phiên làm việc CMS
 */
export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
}

/**
 * Giải mã và kiểm tra tính hợp lệ của JWT Token
 */
export function verifyToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    return decoded as AuthTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Phiên đăng nhập đã hết hạn', ErrorCodes.AUTH_TOKEN_EXPIRED);
    }
    throw AppError.unauthorized('Mã token không hợp lệ', ErrorCodes.AUTH_TOKEN_INVALID);
  }
}

