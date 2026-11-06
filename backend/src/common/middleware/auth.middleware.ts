import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../../integrations/database/prisma.client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  fullName?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware xác thực danh tính người dùng qua JWT Bearer Token.
 * - Kiểm tra định dạng Authorization Header: "Bearer <token>"
 * - Xác thực tính toàn vẹn và thời hạn của token
 * - Truy vấn đối chiếu cơ sở dữ liệu để đảm bảo tài khoản vẫn đang ở trạng thái kích hoạt (isActive = true)
 * - Gắn thông tin tài khoản vào đối tượng `req.user`
 */
export async function jwtAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      AppError.unauthorized('Yêu cầu thiếu Authorization Bearer token', ErrorCodes.UNAUTHORIZED)
    );
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(AppError.unauthorized('Mã token không được bỏ trống', ErrorCodes.UNAUTHORIZED));
  }

  try {
    const payload = verifyToken(token);

    // Kiểm tra trực tiếp người dùng từ cơ sở dữ liệu
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, fullName: true, isActive: true }
    });

    if (!user) {
      return next(
        AppError.unauthorized('Tài khoản người dùng không tồn tại', ErrorCodes.UNAUTHORIZED)
      );
    }

    if (!user.isActive) {
      return next(
        AppError.forbidden(
          'Tài khoản đã bị tạm khóa, vui lòng liên hệ quản trị viên',
          ErrorCodes.USER_INACTIVE
        )
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };

    next();
  } catch (error) {
    next(error);
  }
}

