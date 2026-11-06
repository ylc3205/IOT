import { z } from 'zod';
import { ParkingSessionStatus, PaymentStatus, PricingType, VehicleType } from '@prisma/client';

export const listSessionsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  status: z.nativeEnum(ParkingSessionStatus).optional(),
  parkingLotId: z.string().uuid().optional(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const manualEntrySchema = z.object({
  parkingLotId: z.string().uuid('ID bãi xe phải là định dạng UUID'),
  licensePlate: z.string().min(3, 'Biển số xe phải có ít nhất 3 ký tự').max(20),
  vehicleType: z.nativeEnum(VehicleType, { required_error: 'Loại phương tiện là bắt buộc (CAR hoặc MOTORBIKE)' }),
  manualEntryReason: z.string().min(5, 'Lý do vào thủ công phải có ít nhất 5 ký tự'),
  rfidCardUid: z.string().optional(),
  preferredPricingType: z.nativeEnum(PricingType).optional()
});

export const calculateFeeParamSchema = z.object({
  id: z.string().uuid('ID phiên gửi xe không hợp lệ')
});

export const calculateFeeBodySchema = z.object({
  lockCutoff: z.boolean().optional().default(false)
});

export const confirmPaymentSchema = z.object({
  amount: z.number().positive('Số tiền thu phải lớn hơn 0'),
  note: z.string().optional()
});

export const manualExitSchema = z.object({
  manualExitReason: z.string().min(5, 'Lý do ra thủ công phải có ít nhất 5 ký tự'),
  vehicleDepartedConfirmed: z.boolean().refine((val) => val === true, {
    message: 'Bắt buộc phải xác nhận phương tiện đã thực tế rời bãi (vehicleDepartedConfirmed: true)'
  }),
  markCardAsLost: z.boolean().optional().default(false)
});

export const cancelEntrySchema = z.object({
  cancelReason: z.string().min(3, 'Lý do hủy phiên phải có ít nhất 3 ký tự')
});
