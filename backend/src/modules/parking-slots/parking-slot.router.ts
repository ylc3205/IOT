import { Router } from 'express';
import { parkingSlotController } from './parking-slot.controller';
import {
  createParkingSlotSchema,
  updateParkingSlotSchema,
  parkingSlotParamsSchema,
  parkingLotSlotParamsSchema,
  listSlotsQuerySchema
} from './parking-slot.validation';
import { validateRequest } from '../../common/middleware/validate.middleware';
import { jwtAuthMiddleware } from '../../common/middleware/auth.middleware';

/**
 * Router quản lý vị trí đỗ xe theo ID độc lập (/api/parking-slots)
 */
export const parkingSlotRouter = Router();

parkingSlotRouter.use(jwtAuthMiddleware);

parkingSlotRouter.get(
  '/:id',
  validateRequest({ params: parkingSlotParamsSchema }),
  (req, res, next) => parkingSlotController.getById(req, res, next)
);

parkingSlotRouter.patch(
  '/:id',
  validateRequest({ params: parkingSlotParamsSchema, body: updateParkingSlotSchema }),
  (req, res, next) => parkingSlotController.update(req, res, next)
);

/**
 * Router quản lý vị trí đỗ theo từng bãi (/api/parking-lots/:lotId/slots)
 */
export const lotSlotsRouter = Router({ mergeParams: true });

lotSlotsRouter.use(jwtAuthMiddleware);

lotSlotsRouter.get(
  '/',
  validateRequest({ params: parkingLotSlotParamsSchema, query: listSlotsQuerySchema }),
  (req, res, next) => parkingSlotController.listByLot(req, res, next)
);

lotSlotsRouter.post(
  '/',
  validateRequest({ params: parkingLotSlotParamsSchema, body: createParkingSlotSchema }),
  (req, res, next) => parkingSlotController.create(req, res, next)
);

