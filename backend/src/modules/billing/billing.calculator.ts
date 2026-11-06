import { PricingType, Prisma, VehicleType } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { env } from '../../config/env';
import { prisma } from '../../integrations/database/prisma.client';
import {
  BillingCalculationResult,
  CalculateParkingFeeParams,
  PricingSnapshotResult
} from './billing.types';

export class BillingCalculator {
  /**
   * Tính toán phí gửi xe thuần túy (Pure Logic) dựa trên thời gian đỗ và biểu giá snapshot.
   * - PER_VISIT: Phí cố định theo lượt xe.
   * - PER_HOUR: Tối thiểu 1 giờ, làm tròn lên theo từng giờ lẻ.
   * - Hỗ trợ phụ thu quá giờ ân hạn (Grace Period) mà không bao giờ thu trùng khoản tiền đã nộp.
   */
  public static calculateParkingFee(params: CalculateParkingFeeParams): BillingCalculationResult {
    const {
      entryTime,
      cutoffTime,
      pricingType,
      rate,
      paidAmount = 0,
      lastPaymentTime = null,
      gracePeriodMinutes = env.DEFAULT_EXIT_GRACE_PERIOD_MINUTES
    } = params;

    const pricingRate = new Prisma.Decimal(rate);
    const currentPaidAmount = new Prisma.Decimal(paidAmount);

    // Tính tổng số phút lưu bãi (làm tròn lên phút gần nhất)
    const diffMs = Math.max(0, cutoffTime.getTime() - entryTime.getTime());
    const durationMinutes = Math.max(0, Math.ceil(diffMs / (1000 * 60)));

    let billableHours: number | null = null;
    let totalFee: Prisma.Decimal;

    if (pricingType === PricingType.PER_VISIT) {
      // PER_VISIT: Phí cố định theo lượt, không phụ thuộc vào thời gian đỗ dài hay ngắn
      totalFee = pricingRate;
      billableHours = null;
    } else {
      // PER_HOUR: Khung tối thiểu 1 giờ, bất kỳ phút lẻ nào cũng làm tròn lên (ceil)
      billableHours = Math.max(1, Math.ceil(durationMinutes / 60));
      totalFee = pricingRate.mul(billableHours);
    }

    // Kiểm tra thời gian ân hạn rời bãi (Grace Period)
    let isGracePeriodActive = false;
    let isOvertimeSurchargeRequired = false;

    if (lastPaymentTime) {
      const gracePeriodMs = gracePeriodMinutes * 60 * 1000;
      const gracePeriodExpiry = new Date(lastPaymentTime.getTime() + gracePeriodMs);

      if (cutoffTime.getTime() <= gracePeriodExpiry.getTime()) {
        isGracePeriodActive = true;
      } else {
        // Đã quá hạn ân hạn: Nếu là PER_HOUR và tổng phí mới lớn hơn số tiền đã trả thì yêu cầu phụ thu
        if (pricingType === PricingType.PER_HOUR && totalFee.greaterThan(currentPaidAmount)) {
          isOvertimeSurchargeRequired = true;
        }
      }
    }

    // Số tiền còn thiếu cần thanh toán = max(0, totalFee - paidAmount)
    const amountDue = totalFee.greaterThan(currentPaidAmount)
      ? totalFee.sub(currentPaidAmount)
      : new Prisma.Decimal(0);

    return {
      durationMinutes,
      billableHours,
      pricingType,
      pricingRate,
      totalFee,
      paidAmount: currentPaidAmount,
      amountDue,
      isGracePeriodActive,
      isOvertimeSurchargeRequired
    };
  }

  /**
   * Truy vấn quy tắc biểu giá tương ứng và chụp ảnh (Snapshot) tại thời điểm xe vào bãi
   */
  public static async resolvePricingSnapshot(
    lotId: string,
    vehicleType: VehicleType,
    preferredPricingType?: PricingType,
    client: typeof prisma = prisma
  ): Promise<PricingSnapshotResult> {
    const rules = await client.pricingRule.findMany({
      where: {
        parkingLotId: lotId,
        vehicleType,
        isActive: true
      }
    });

    if (rules.length === 0) {
      throw AppError.badRequest(
        `Chưa cấu hình biểu phí cho loại phương tiện ${vehicleType} trong bãi đỗ xe này`,
        ErrorCodes.PRICING_RULE_NOT_CONFIGURED
      );
    }

    // Tìm rule khớp với preferredPricingType (nếu có), hoặc lấy rule đầu tiên
    const matchedRule = preferredPricingType
      ? rules.find((r) => r.pricingType === preferredPricingType) || rules[0]
      : rules[0];

    if (!matchedRule) {
      throw AppError.badRequest(
        `Chưa cấu hình biểu phí cho loại phương tiện ${vehicleType} trong bãi đỗ xe này`,
        ErrorCodes.PRICING_RULE_NOT_CONFIGURED
      );
    }

    return {
      pricingRuleId: matchedRule.id,
      pricingType: matchedRule.pricingType,
      pricingRate: matchedRule.amount
    };
  }
}
