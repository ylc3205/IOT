import { Router } from 'express';
import { parkingLotController } from './parking-lot.controller';
import {
  createParkingLotSchema,
  updateParkingLotSchema,
  parkingLotParamsSchema,
  listParkingLotsQuerySchema
} from './parking-lot.validation';
import { lotSlotsRouter } from '../parking-slots/parking-slot.router';
import { validateRequest } from '../../common/middleware/validate.middleware';
import { jwtAuthMiddleware } from '../../common/middleware/auth.middleware';

export const parkingLotRouter = Router();

// Tất cả endpoints ParkingLot yêu cầu xác thực JWT Bearer
parkingLotRouter.use(jwtAuthMiddleware);

// Gắn sub-router quản lý vị trí đỗ theo bãi: /api/parking-lots/:lotId/slots
parkingLotRouter.use('/:lotId/slots', lotSlotsRouter);

parkingLotRouter.get(
  '/',
  validateRequest({ query: listParkingLotsQuerySchema }),
  (req, res, next) => parkingLotController.list(req, res, next)
);

parkingLotRouter.get(
  '/:id',
  validateRequest({ params: parkingLotParamsSchema }),
  (req, res, next) => parkingLotController.getById(req, res, next)
);

parkingLotRouter.post(
  '/',
  validateRequest({ body: createParkingLotSchema }),
  (req, res, next) => parkingLotController.create(req, res, next)
);

parkingLotRouter.patch(
  '/:id',
  validateRequest({ params: parkingLotParamsSchema, body: updateParkingLotSchema }),
  (req, res, next) => parkingLotController.update(req, res, next)
);

parkingLotRouter.get(
  '/:id/occupancy',
  validateRequest({ params: parkingLotParamsSchema }),
  (req, res, next) => parkingLotController.getOccupancy(req, res, next)
);
