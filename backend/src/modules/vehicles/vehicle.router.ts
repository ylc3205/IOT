import { Router } from 'express';
import { vehicleController } from './vehicle.controller';
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleParamsSchema,
  listVehiclesQuerySchema
} from './vehicle.validation';
import { validateRequest } from '../../common/middleware/validate.middleware';
import { jwtAuthMiddleware } from '../../common/middleware/auth.middleware';

export const vehicleRouter = Router();

// Toàn bộ API Vehicle yêu cầu xác thực JWT Bearer
vehicleRouter.use(jwtAuthMiddleware);

vehicleRouter.get(
  '/',
  validateRequest({ query: listVehiclesQuerySchema }),
  (req, res, next) => vehicleController.list(req, res, next)
);

vehicleRouter.get(
  '/:id',
  validateRequest({ params: vehicleParamsSchema }),
  (req, res, next) => vehicleController.getById(req, res, next)
);

vehicleRouter.post(
  '/',
  validateRequest({ body: createVehicleSchema }),
  (req, res, next) => vehicleController.create(req, res, next)
);

vehicleRouter.patch(
  '/:id',
  validateRequest({ params: vehicleParamsSchema, body: updateVehicleSchema }),
  (req, res, next) => vehicleController.update(req, res, next)
);

