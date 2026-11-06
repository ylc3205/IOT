import { Router } from 'express';
import { authController } from './auth.controller';
import { loginSchema } from './auth.validation';
import { validateRequest } from '../../common/middleware/validate.middleware';
import { jwtAuthMiddleware } from '../../common/middleware/auth.middleware';

export const authRouter = Router();

// Endpoint xác thực đăng nhập (Public)
authRouter.post('/login', validateRequest({ body: loginSchema }), (req, res, next) =>
  authController.login(req, res, next)
);

// Endpoint lấy thông tin tài khoản hiện hành (Protected)
authRouter.get('/me', jwtAuthMiddleware, (req, res, next) =>
  authController.getMe(req, res, next)
);

