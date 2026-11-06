import { z } from 'zod';
import { RfidCardStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../common/utils/pagination';

export const createRfidCardSchema = z.object({
  uid: z
    .string({ required_error: 'Mã UID thẻ RFID không được để trống' })
    .min(4, 'Mã UID phải có ít nhất 4 ký tự')
    .trim(),
  vehicleId: z.string().uuid('ID phương tiện phải là UUID hợp lệ').optional().nullable(),
  status: z.nativeEnum(RfidCardStatus).optional()
});

export const updateRfidCardSchema = z.object({
  uid: z.string().min(4).trim().optional(),
  status: z.nativeEnum(RfidCardStatus).optional()
});

export const assignRfidCardSchema = z.object({
  vehicleId: z.string().uuid('ID phương tiện phải là UUID hợp lệ')
});

export const rfidCardParamsSchema = z.object({
  id: z.string().uuid('ID thẻ RFID phải là UUID hợp lệ')
});

export const listRfidCardsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(RfidCardStatus).optional(),
  isAssigned: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' : undefined)),
  search: z.string().trim().optional()
});

export type CreateRfidCardInput = z.infer<typeof createRfidCardSchema>;
export type UpdateRfidCardInput = z.infer<typeof updateRfidCardSchema>;
export type AssignRfidCardInput = z.infer<typeof assignRfidCardSchema>;
export type ListRfidCardsQuery = z.infer<typeof listRfidCardsQuerySchema>;

