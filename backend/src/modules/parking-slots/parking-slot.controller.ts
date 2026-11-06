import { Request, Response, NextFunction } from 'express';
import { parkingSlotService } from './parking-slot.service';
import { sendSuccess } from '../../common/utils/api-response';

export class ParkingSlotController {
  public async listByLot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lotId = req.params.lotId as string;
      const result = await parkingSlotService.listSlotsByLot(lotId, req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await parkingSlotService.getSlotById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lotId = req.params.lotId as string;
      const result = await parkingSlotService.createSlot(lotId, req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await parkingSlotService.updateSlot(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const parkingSlotController = new ParkingSlotController();
