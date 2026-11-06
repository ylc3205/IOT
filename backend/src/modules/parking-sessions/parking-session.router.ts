import { Router } from 'express';
import { z } from 'zod';
import { parkingSessionController } from './parking-session.controller';
import {
  cancelEntrySchema,
  confirmPaymentSchema,
  listSessionsQuerySchema,
  manualEntrySchema,
  manualExitSchema,
  calculateFeeBodySchema
} from './parking-session.validation';
import { validateRequest } from '../../common/middleware/validate.middleware';
import { jwtAuthMiddleware } from '../../common/middleware/auth.middleware';
import { idempotencyMiddleware } from '../../common/middleware/idempotency.middleware';

export const parkingSessionRouter = Router();

// Tất cả endpoints quản lý phiên gửi xe yêu cầu xác thực JWT Bearer
parkingSessionRouter.use(jwtAuthMiddleware);

const sessionParamsSchema = z.object({
  id: z.string().uuid('ID phiên gửi xe phải là định dạng UUID')
});

// 1. Danh sách phiên có phân trang & bộ lọc
parkingSessionRouter.get(
  '/',
  validateRequest({ query: listSessionsQuerySchema }),
  (req, res, next) => parkingSessionController.listSessions(req, res, next)
);

// 2. Danh sách xe đang thực tế đỗ trong bãi (ACTIVE)
parkingSessionRouter.get(
  '/active',
  (req, res, next) => parkingSessionController.getActiveSessions(req, res, next)
);

// 3. Xem chi tiết một phiên gửi xe
parkingSessionRouter.get(
  '/:id',
  validateRequest({ params: sessionParamsSchema }),
  (req, res, next) => parkingSessionController.getSessionById(req, res, next)
);

// 4. Vào bãi thủ công (Manual Entry) kèm Idempotency
parkingSessionRouter.post(
  '/manual-entry',
  idempotencyMiddleware,
  validateRequest({ body: manualEntrySchema }),
  (req, res, next) => parkingSessionController.manualEntry(req, res, next)
);

// 5. Tính toán cước phí / chốt cước tại thời điểm ra
parkingSessionRouter.post(
  '/:id/calculate-fee',
  validateRequest({ params: sessionParamsSchema, body: calculateFeeBodySchema }),
  (req, res, next) => parkingSessionController.calculateFee(req, res, next)
);

// 6. Xác nhận thu tiền mặt (Confirm Payment) kèm Idempotency
parkingSessionRouter.post(
  '/:id/confirm-payment',
  idempotencyMiddleware,
  validateRequest({ params: sessionParamsSchema, body: confirmPaymentSchema }),
  (req, res, next) => parkingSessionController.confirmPayment(req, res, next)
);

// 7. Ra bãi thủ công (Manual Exit) kèm Idempotency
parkingSessionRouter.post(
  '/:id/manual-exit',
  idempotencyMiddleware,
  validateRequest({ params: sessionParamsSchema, body: manualExitSchema }),
  (req, res, next) => parkingSessionController.manualExit(req, res, next)
);

// 8. Hủy phiên chờ vào (Cancel Entry)
parkingSessionRouter.post(
  '/:id/cancel-entry',
  validateRequest({ params: sessionParamsSchema, body: cancelEntrySchema }),
  (req, res, next) => parkingSessionController.cancelEntry(req, res, next)
);
