import { PricingType, Prisma } from '@prisma/client';

export interface CalculateParkingFeeParams {
  entryTime: Date;
  cutoffTime: Date;
  pricingType: PricingType;
  rate: Prisma.Decimal | number | string;
  paidAmount?: Prisma.Decimal | number | string;
  lastPaymentTime?: Date | null;
  gracePeriodMinutes?: number;
}

export interface BillingCalculationResult {
  durationMinutes: number;
  billableHours: number | null;
  pricingType: PricingType;
  pricingRate: Prisma.Decimal;
  totalFee: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  amountDue: Prisma.Decimal;
  isGracePeriodActive: boolean;
  isOvertimeSurchargeRequired: boolean;
}

export interface PricingSnapshotResult {
  pricingRuleId: string;
  pricingType: PricingType;
  pricingRate: Prisma.Decimal;
}
