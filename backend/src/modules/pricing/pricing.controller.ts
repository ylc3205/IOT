import { Request, Response, NextFunction } from 'express';
import { pricingService } from './pricing.service';
import { sendSuccess } from '../../common/utils/api-response';

export class PricingController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await pricingService.listPricingRules(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await pricingService.getPricingRuleById(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await pricingService.createPricingRule(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await pricingService.updatePricingRule(id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const pricingController = new PricingController();
