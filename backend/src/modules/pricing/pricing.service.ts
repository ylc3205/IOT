import { prisma } from '../../integrations/database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  CreatePricingRuleInput,
  UpdatePricingRuleInput,
  ListPricingRulesQuery
} from './pricing.validation';
import { PricingRule, Prisma } from '@prisma/client';

export class PricingService {
  /**
   * Danh sách quy tắc biểu phí gửi xe
   */
  public async listPricingRules(query: ListPricingRulesQuery): Promise<PricingRule[]> {
    const where: any = {};

    if (query.parkingLotId) {
      where.parkingLotId = query.parkingLotId;
    }

    if (query.vehicleType) {
      where.vehicleType = query.vehicleType;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    return prisma.pricingRule.findMany({
      where,
      orderBy: [{ parkingLotId: 'asc' }, { vehicleType: 'asc' }],
      include: {
        parkingLot: {
          select: { id: true, name: true }
        }
      }
    });
  }

  /**
   * Chi tiết một quy tắc tính phí theo ID
   */
  public async getPricingRuleById(id: string): Promise<PricingRule> {
    const rule = await prisma.pricingRule.findUnique({
      where: { id },
      include: {
        parkingLot: {
          select: { id: true, name: true }
        }
      }
    });

    if (!rule) {
      throw AppError.notFound('Không tìm thấy quy tắc biểu phí', ErrorCodes.PRICING_RULE_NOT_FOUND);
    }

    return rule;
  }

  /**
   * Tạo mới quy tắc tính phí cho bãi xe
   */
  public async createPricingRule(input: CreatePricingRuleInput): Promise<PricingRule> {
    const lot = await prisma.parkingLot.findUnique({
      where: { id: input.parkingLotId }
    });

    if (!lot) {
      throw AppError.notFound('Bãi đỗ xe chỉ định không tồn tại', ErrorCodes.PARKING_LOT_NOT_FOUND);
    }

    const existing = await prisma.pricingRule.findUnique({
      where: {
        parkingLotId_vehicleType_pricingType: {
          parkingLotId: input.parkingLotId,
          vehicleType: input.vehicleType,
          pricingType: input.pricingType
        }
      }
    });

    if (existing) {
      throw AppError.conflict(
        `Đã tồn tại biểu phí cho loại xe "${input.vehicleType}" với hình thức "${input.pricingType}" tại bãi xe này`,
        ErrorCodes.PRICING_RULE_EXISTS
      );
    }

    return prisma.pricingRule.create({
      data: {
        parkingLotId: input.parkingLotId,
        vehicleType: input.vehicleType,
        pricingType: input.pricingType,
        amount: new Prisma.Decimal(input.amount),
        isActive: true
      },
      include: {
        parkingLot: {
          select: { id: true, name: true }
        }
      }
    });
  }

  /**
   * Cập nhật số tiền hoặc trạng thái kích hoạt của quy tắc biểu phí
   */
  public async updatePricingRule(id: string, input: UpdatePricingRuleInput): Promise<PricingRule> {
    await this.getPricingRuleById(id);

    return prisma.pricingRule.update({
      where: { id },
      data: {
        ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      },
      include: {
        parkingLot: {
          select: { id: true, name: true }
        }
      }
    });
  }
}

export const pricingService = new PricingService();

