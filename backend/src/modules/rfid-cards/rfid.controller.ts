import { Request, Response, NextFunction } from 'express';
import { rfidService } from './rfid.service';
import { sendSuccess } from '../../common/utils/api-response';

export class RfidController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await rfidService.listCards(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await rfidService.getCardById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await rfidService.createCard(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await rfidService.updateCard(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await rfidService.assignCard(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async unassign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await rfidService.unassignCard(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async block(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await rfidService.blockCard(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async unblock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await rfidService.unblockCard(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const rfidController = new RfidController();
