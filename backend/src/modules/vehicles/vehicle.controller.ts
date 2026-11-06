import { Request, Response, NextFunction } from 'express';
import { vehicleService } from './vehicle.service';
import { sendSuccess } from '../../common/utils/api-response';

export class VehicleController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await vehicleService.listVehicles(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await vehicleService.getVehicleById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await vehicleService.createVehicle(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await vehicleService.updateVehicle(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const vehicleController = new VehicleController();
