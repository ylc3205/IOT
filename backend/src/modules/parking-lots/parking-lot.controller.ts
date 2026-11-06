import { Request, Response, NextFunction } from 'express';
import { parkingLotService } from './parking-lot.service';
import { sendSuccess } from '../../common/utils/api-response';

export class ParkingLotController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await parkingLotService.listParkingLots(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await parkingLotService.getParkingLotById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await parkingLotService.createParkingLot(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await parkingLotService.updateParkingLot(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getOccupancy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await parkingLotService.getOccupancy(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const parkingLotController = new ParkingLotController();
