import { z } from 'zod';
import { VehicleType, PricingType } from '@prisma/client';

export const createPricingRuleSchema = z.object({
  parkingLotId: z.string().uuid('ID bãi đỗ xe phải là UUID hợp lệ'),
  vehicleType: z.nativeEnum(VehicleType, {
    errorMap: () => ({ message: 'Loại phương tiện phải là CAR hoặc MOTORBIKE' })
  }),
  pricingType: z.nativeEnum(PricingType, {
    errorMap: () => ({ message: 'Hình thức tính phí phải là PER_VISIT hoặc PER_HOUR' })
  }),
  amount: z
    .number({ required_error: 'Số tiền không được để trống' })
    .min(0, 'Mức giá không được phép là số âm (>= 0)')
});

export const updatePricingRuleSchema = z.object({
  amount: z.number().min(0, 'Mức giá không được phép là số âm (>= 0)').optional(),
  isActive: z.boolean().optional()
});

export const pricingRuleParamsSchema = z.object({
  id: z.string().uuid('ID quy tắc tính phí phải là UUID hợp lệ')
});

export const listPricingRulesQuerySchema = z.object({
  parkingLotId: z.string().uuid().optional(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' : undefined))
});

export type CreatePricingRuleInput = z.infer<typeof createPricingRuleSchema>;
export type UpdatePricingRuleInput = z.infer<typeof updatePricingRuleSchema>;
export type ListPricingRulesQuery = z.infer<typeof listPricingRulesQuerySchema>;

