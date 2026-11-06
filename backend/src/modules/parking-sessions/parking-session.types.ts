import { ParkingSessionStatus, PaymentStatus, PricingType, VehicleType } from '@prisma/client';

export interface ListSessionsQuery {
  page?: number;
  limit?: number;
  status?: ParkingSessionStatus;
  parkingLotId?: string;
  vehicleType?: VehicleType;
  paymentStatus?: PaymentStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface ManualEntryInput {
  parkingLotId: string;
  licensePlate: string;
  vehicleType: VehicleType;
  manualEntryReason: string;
  rfidCardUid?: string;
  preferredPricingType?: PricingType;
}

export interface ConfirmPaymentInput {
  amount: number;
  note?: string;
}

export interface ManualExitInput {
  manualExitReason: string;
  vehicleDepartedConfirmed: boolean;
  markCardAsLost?: boolean;
}

export interface CancelEntryInput {
  cancelReason: string;
}
