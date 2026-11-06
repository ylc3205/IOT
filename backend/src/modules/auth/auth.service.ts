import bcrypt from 'bcryptjs';
import { prisma } from '../../integrations/database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { signToken } from '../../common/utils/jwt';
import { LoginInput } from './auth.validation';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
}

export interface UserProfileResult {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export class AuthService {
  /**
   * Xác thực đăng nhập tài khoản CMS bằng email và mật khẩu
   */
  public async login(input: LoginInput): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (!user || !user.passwordHash) {
      throw AppError.badRequest(
        'Email hoặc mật khẩu không chính xác',
        ErrorCodes.AUTH_INVALID_CREDENTIALS
      );
    }

    if (!user.isActive) {
      throw AppError.forbidden(
        'Tài khoản này đã bị tạm khóa, vui lòng liên hệ quản trị viên',
        ErrorCodes.USER_INACTIVE
      );
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest(
        'Email hoặc mật khẩu không chính xác',
        ErrorCodes.AUTH_INVALID_CREDENTIALS
      );
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    };
  }

  /**
   * Lấy thông tin tài khoản hiện hành từ token hợp lệ
   */
  public async getMe(userId: string): Promise<UserProfileResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      throw AppError.notFound('Không tìm thấy tài khoản người dùng', ErrorCodes.NOT_FOUND);
    }

    return user;
  }
}

export const authService = new AuthService();

