import { Router } from 'express';
import { rfidController } from './rfid.controller';
import {
  createRfidCardSchema,
  updateRfidCardSchema,
  assignRfidCardSchema,
  rfidCardParamsSchema,
  listRfidCardsQuerySchema
} from './rfid.validation';
import { validateRequest } from '../../common/middleware/validate.middleware';
import { jwtAuthMiddleware } from '../../common/middleware/auth.middleware';

export const rfidRouter = Router();

// Toàn bộ API RFID yêu cầu xác thực JWT Bearer
rfidRouter.use(jwtAuthMiddleware);

rfidRouter.get(
  '/',
  validateRequest({ query: listRfidCardsQuerySchema }),
  (req, res, next) => rfidController.list(req, res, next)
);

rfidRouter.get(
  '/:id',
  validateRequest({ params: rfidCardParamsSchema }),
  (req, res, next) => rfidController.getById(req, res, next)
);

rfidRouter.post(
  '/',
  validateRequest({ body: createRfidCardSchema }),
  (req, res, next) => rfidController.create(req, res, next)
);

rfidRouter.patch(
  '/:id',
  validateRequest({ params: rfidCardParamsSchema, body: updateRfidCardSchema }),
  (req, res, next) => rfidController.update(req, res, next)
);

rfidRouter.post(
  '/:id/assign',
  validateRequest({ params: rfidCardParamsSchema, body: assignRfidCardSchema }),
  (req, res, next) => rfidController.assign(req, res, next)
);

rfidRouter.post(
  '/:id/unassign',
  validateRequest({ params: rfidCardParamsSchema }),
  (req, res, next) => rfidController.unassign(req, res, next)
);

rfidRouter.post(
  '/:id/block',
  validateRequest({ params: rfidCardParamsSchema }),
  (req, res, next) => rfidController.block(req, res, next)
);

rfidRouter.post(
  '/:id/unblock',
  validateRequest({ params: rfidCardParamsSchema }),
  (req, res, next) => rfidController.unblock(req, res, next)
);

