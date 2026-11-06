import { Request, Response, NextFunction } from 'express';
import { parkingSessionService } from './parking-session.service';
import { sendSuccess } from '../../common/utils/api-response';

export class ParkingSessionController {
  public async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await parkingSessionService.listSessions(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getActiveSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parkingLotId = req.query.parkingLotId as string | undefined;
      const sessions = await parkingSessionService.getActiveSessions(parkingLotId);
      sendSuccess(res, sessions, 200);
    } catch (error) {
      next(error);
    }
  }

  public async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const session = await parkingSessionService.getSessionById(id);
      sendSuccess(res, session, 200);
    } catch (error) {
      next(error);
    }
  }

  public async manualEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const operatorId = (req as any).user.id;
      const session = await parkingSessionService.manualEntry(operatorId, req.body);
      sendSuccess(res, session, 201);
    } catch (error) {
      next(error);
    }
  }

  public async calculateFee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const lockCutoff = Boolean(req.body?.lockCutoff);
      const result = await parkingSessionService.calculateFee(id, lockCutoff);
      sendSuccess(
        res,
        {
          session: result.session,
          feeCalculation: {
            durationMinutes: result.feeResult.durationMinutes,
            billableHours: result.feeResult.billableHours,
            pricingType: result.feeResult.pricingType,
            pricingRate: result.feeResult.pricingRate,
            totalFee: result.feeResult.totalFee,
            paidAmount: result.feeResult.paidAmount,
            amountDue: result.feeResult.amountDue,
            isGracePeriodActive: result.feeResult.isGracePeriodActive,
            isOvertimeSurchargeRequired: result.feeResult.isOvertimeSurchargeRequired
          }
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }

  public async confirmPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const operatorId = (req as any).user.id;
      const id = req.params.id as string;
      const result = await parkingSessionService.confirmPayment(operatorId, id, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public async manualExit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const operatorId = (req as any).user.id;
      const id = req.params.id as string;
      const session = await parkingSessionService.manualExit(operatorId, id, req.body);
      sendSuccess(res, session, 200);
    } catch (error) {
      next(error);
    }
  }

  public async cancelEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const session = await parkingSessionService.cancelEntry(id, req.body);
      sendSuccess(res, session, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const parkingSessionController = new ParkingSessionController();
