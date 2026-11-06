import { z } from 'zod';
import { VehicleType } from '@prisma/client';
import { paginationQuerySchema } from '../../common/utils/pagination';

export const createVehicleSchema = z.object({
  licensePlate: z
    .string({ required_error: 'Biển số xe không được để trống' })
    .min(3, 'Biển số xe phải chứa ít nhất 3 ký tự')
    .trim(),
  vehicleType: z.nativeEnum(VehicleType, {
    errorMap: () => ({ message: 'Loại phương tiện phải là CAR hoặc MOTORBIKE' })
  })
});

export const updateVehicleSchema = z.object({
  licensePlate: z.string().min(3).trim().optional(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
  isActive: z.boolean().optional()
});

export const vehicleParamsSchema = z.object({
  id: z.string().uuid('ID phương tiện phải là định dạng UUID hợp lệ')
});

export const listVehiclesQuerySchema = paginationQuerySchema.extend({
  vehicleType: z.nativeEnum(VehicleType).optional(),
  search: z.string().trim().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' : undefined))
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;

