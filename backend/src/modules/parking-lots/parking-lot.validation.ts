import { z } from 'zod';
import { paginationQuerySchema } from '../../common/utils/pagination';

export const createParkingLotSchema = z.object({
  name: z
    .string({ required_error: 'Tên bãi đỗ xe không được để trống' })
    .min(2, 'Tên bãi đỗ xe tối thiểu 2 ký tự')
    .trim(),
  location: z.string().trim().optional(),
  totalCapacity: z
    .number({ required_error: 'Sức chứa tối đa không được để trống' })
    .int('Sức chứa phải là số nguyên')
    .positive('Sức chứa phải lớn hơn 0')
});

export const updateParkingLotSchema = z.object({
  name: z.string().min(2).trim().optional(),
  location: z.string().trim().optional().nullable(),
  totalCapacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
});

export const parkingLotParamsSchema = z.object({
  id: z.string().uuid('ID bãi đỗ xe phải có định dạng UUID hợp lệ')
});

export const listParkingLotsQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' : undefined))
});

export type CreateParkingLotInput = z.infer<typeof createParkingLotSchema>;
export type UpdateParkingLotInput = z.infer<typeof updateParkingLotSchema>;
export type ListParkingLotsQuery = z.infer<typeof listParkingLotsQuerySchema>;

